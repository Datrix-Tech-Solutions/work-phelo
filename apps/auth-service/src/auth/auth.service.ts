import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForceResetPasswordDto } from './dto/force-reset-password.dto';
import { SendSmsOtpDto } from './dto/send-sms-otp.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import {
  generateOtp,
  generateSecureToken,
  otpExpiresAt,
} from '../common/otp.helper';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantsService: TenantsService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);
    if (tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant account is not active');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'SUSPENDED')
      throw new ForbiddenException(
        'Account suspended. Contact your administrator.',
      );
    if (user.status === 'INACTIVE')
      throw new ForbiddenException(
        'Account is inactive. Contact your administrator.',
      );
    if (user.status === 'PENDING_VERIFICATION')
      throw new ForbiddenException(
        'Please verify your email before logging in.',
      );

    if (!user.password)
      throw new UnauthorizedException(
        'Please sign in using your social account.',
      );

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    if (user.forcePasswordReset) {
      return { requiresPasswordReset: true, userId: user.id };
    }

    if (user.isMfaEnabled) {
      if (!dto.totpCode) {
        return {
          requiresMfa: true,
          mfaMethod: user.mfaMethod,
          userId: user.id,
        };
      }
      if (user.mfaMethod === 'TOTP') {
        const isValid = authenticator.verify({
          token: dto.totpCode,
          secret: user.mfaSecret!,
        });
        if (!isValid)
          throw new UnauthorizedException('Invalid authenticator code');
      } else if (user.mfaMethod === 'SMS') {
        await this.verifyOtpCode(user.id, 'MFA_SMS', dto.totpCode);
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(
      user,
      tenant,
      ipAddress,
      userAgent,
    );
    const { password, mfaSecret, inviteToken, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  // ── ADMIN LOGIN ───────────────────────────────────────────────────────────
  async adminLogin(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email, role: 'SUPER_ADMIN' },
      include: { tenant: true },
    });

    if (!user || !user.password)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(
      user,
      user.tenant,
      ipAddress,
      userAgent,
    );
    const { password: pw, mfaSecret, inviteToken, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  // ── EMAIL VERIFICATION ────────────────────────────────────────────────────
  async verifyEmail(dto: VerifyEmailDto) {
    const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerifiedAt)
      throw new BadRequestException('Email already verified');

    await this.verifyOtpCode(user.id, 'EMAIL_VERIFICATION', dto.otp);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerifiedAt)
      throw new BadRequestException('Email already verified');

    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, type: 'EMAIL_VERIFICATION', usedAt: null },
      data: { usedAt: new Date() },
    });

    const otp = generateOtp(6);
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        code: otp,
        expiresAt: otpExpiresAt(10),
      },
    });

    this.rabbitmq.sendEmailVerification({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      otp,
    });

    return { message: 'Verification code resent. Please check your email.' };
  }

  // ── REFRESH ───────────────────────────────────────────────────────────────
  async refresh(dto: RefreshTokenDto) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: { include: { tenant: true } } },
    });

    if (
      !storedToken ||
      storedToken.isRevoked ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    return this.generateTokens(
      storedToken.user,
      storedToken.user.tenant,
      storedToken.ipAddress ?? undefined,
      storedToken.userAgent ?? undefined,
      storedToken.deviceName ?? undefined,
      storedToken.deviceId ?? undefined,
    );
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    return { message: 'Logged out from all devices' };
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });

    if (!user)
      return {
        message: 'If this email exists, you will receive reset instructions.',
      };

    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    });

    if (dto.method === 'email') {
      const resetToken = generateSecureToken();
      await this.prisma.otpCode.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          code: resetToken,
          expiresAt: otpExpiresAt(60),
        },
      });
      this.rabbitmq.sendPasswordResetLink({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        firstName: user.firstName,
        resetToken,
      });
    } else {
      if (!user.phone)
        throw new BadRequestException('No phone number on file for SMS reset');
      const otp = generateOtp(6);
      await this.prisma.otpCode.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          code: otp,
          expiresAt: otpExpiresAt(60),
        },
      });
      this.rabbitmq.sendSmsOtp({
        userId: user.id,
        tenantId: user.tenantId,
        phone: user.phone,
        otp,
        context: 'password reset',
      });
    }

    return {
      message: 'If this email exists, you will receive reset instructions.',
    };
  }

  // ── RESET PASSWORD ────────────────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    if (!dto.token && !dto.otpCode)
      throw new BadRequestException('Token or OTP code required');

    let userId: string;

    if (dto.token) {
      const record = await this.prisma.otpCode.findFirst({
        where: {
          code: dto.token,
          type: 'PASSWORD_RESET',
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!record)
        throw new BadRequestException('Invalid or expired reset link');
      userId = record.userId;
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    } else {
      if (!dto.email || !dto.tenantSlug)
        throw new BadRequestException('Email and tenant slug required');
      const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);
      const user = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
      });
      if (!user) throw new NotFoundException('User not found');
      await this.verifyOtpCode(user.id, 'PASSWORD_RESET', dto.otpCode!);
      userId = user.id;
    }

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        passwordChangedAt: new Date(),
        forcePasswordReset: false,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return {
      message:
        'Password reset successfully. Please log in with your new password.',
    };
  }

  // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, passwordChangedAt: new Date() },
    });

    return { message: 'Password changed successfully' };
  }

  // ── FORCE RESET PASSWORD ──────────────────────────────────────────────────
  async forceResetPassword(dto: ForceResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.forcePasswordReset)
      throw new BadRequestException('Password reset not required');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        password: hashed,
        passwordChangedAt: new Date(),
        forcePasswordReset: false,
      },
    });

    const tenant = await this.tenantsService.findById(user.tenantId);
    return this.generateTokens(user, tenant);
  }

  // ── MFA TOTP ──────────────────────────────────────────────────────────────
  async setupTotp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isMfaEnabled)
      throw new BadRequestException('MFA is already enabled');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(
      user.email,
      'WorkPhelo ERP',
      secret,
    );
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaMethod: 'TOTP' },
    });

    return { secret, qrCodeDataUrl };
  }

  async verifyAndEnableMfa(dto: VerifyMfaDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user || !user.mfaSecret)
      throw new BadRequestException('MFA setup not initiated');

    const isValid = authenticator.verify({
      token: dto.totpCode,
      secret: user.mfaSecret,
    });
    if (!isValid) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { isMfaEnabled: true },
    });

    return { message: 'Authenticator MFA enabled successfully' };
  }

  // ── MFA SMS ───────────────────────────────────────────────────────────────
  async sendSmsMfaOtp(dto: SendSmsOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.phone) throw new BadRequestException('No phone number on file');

    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, type: 'MFA_SMS', usedAt: null },
      data: { usedAt: new Date() },
    });

    const otp = generateOtp(6);
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        type: 'MFA_SMS',
        code: otp,
        expiresAt: otpExpiresAt(10),
      },
    });

    this.rabbitmq.sendSmsOtp({
      userId: user.id,
      tenantId: user.tenantId,
      phone: user.phone,
      otp,
      context: 'verification',
    });

    return { message: 'OTP sent to your registered phone number' };
  }

  async verifySmsMfaAndEnable(userId: string, otpCode: string) {
    await this.verifyOtpCode(userId, 'MFA_SMS', otpCode);
    await this.prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: true, mfaMethod: 'SMS' },
    });
    return { message: 'SMS MFA enabled successfully' };
  }

  async disableMfa(userId: string, totpCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isMfaEnabled)
      throw new BadRequestException('MFA is not enabled');

    if (user.mfaMethod === 'TOTP') {
      const isValid = authenticator.verify({
        token: totpCode,
        secret: user.mfaSecret!,
      });
      if (!isValid) throw new UnauthorizedException('Invalid TOTP code');
    } else {
      await this.verifyOtpCode(userId, 'MFA_SMS', totpCode);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: false, mfaSecret: null, mfaMethod: null },
    });

    return { message: 'MFA disabled successfully' };
  }

  // ── SOCIAL AUTH ───────────────────────────────────────────────────────────
  async handleSocialLogin(
    profile: any,
    provider: 'GOOGLE' | 'MICROSOFT',
    tenantSlug: string,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email)
      throw new BadRequestException('No email returned from social provider');

    const existing = await this.prisma.socialAccount.findUnique({
      where: { provider_providerId: { provider, providerId: profile.id } },
      include: { user: { include: { tenant: true } } },
    });

    if (existing) {
      const { password, mfaSecret, inviteToken, ...safeUser } = existing.user;
      const tokens = await this.generateTokens(
        existing.user,
        existing.user.tenant,
      );
      return { user: safeUser, ...tokens };
    }

    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });

    if (!user)
      throw new NotFoundException(
        'No account found. Please contact your administrator.',
      );
    if (user.status !== 'ACTIVE')
      throw new ForbiddenException('Account is not active');

    await this.prisma.socialAccount.create({
      data: { userId: user.id, provider, providerId: profile.id, email },
    });

    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    const { password, mfaSecret, inviteToken, ...safeUser } = user;
    const tokens = await this.generateTokens(user, tenant);
    return { user: safeUser, ...tokens };
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────
  private async verifyOtpCode(userId: string, type: any, code: string) {
    const record = await this.prisma.otpCode.findFirst({
      where: {
        userId,
        type,
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) throw new UnauthorizedException('Invalid or expired code');
    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return record;
  }

  private async generateTokens(
    user: any,
    tenant: any,
    ipAddress?: string,
    userAgent?: string,
    deviceName?: string,
    deviceId?: string,
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenValue,
        expiresAt,
        ipAddress,
        userAgent,
        deviceName,
        deviceId,
      },
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }
}
