import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForceResetPasswordDto } from './dto/force-reset-password.dto';
import { SendSmsOtpDto } from './dto/send-sms-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { MicrosoftAuthGuard } from './guards/microsoft-auth.guard';
import { setAuthCookies, clearAuthCookies } from '../common/cookie.helper';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── STANDARD AUTH ─────────────────────────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );

    // If MFA or force reset required — return without setting cookies
    if ('requiresMfa' in result || 'requiresPasswordReset' in result) {
      return result;
    }

    setAuthCookies(res, result.accessToken, result.refreshToken);
    const { accessToken, refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.adminLogin(
      body.email,
      body.password,
      req.ip,
      req.headers['user-agent'],
    );

    setAuthCookies(res, result.accessToken, result.refreshToken);
    const { accessToken, refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  // ── TOKEN MANAGEMENT ──────────────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Read refresh token from cookie
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    const result = await this.authService.refresh({ refreshToken });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { message: 'Tokens refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(req.user.id);
    clearAuthCookies(res);
    return { message: 'Logged out from all devices' };
  }

  // ── PASSWORD ──────────────────────────────────────────────────────────────
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @Post('force-reset-password')
  @HttpCode(HttpStatus.OK)
  async forceResetPassword(
    @Body() dto: ForceResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.forceResetPassword(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const { accessToken, refreshToken, ...safeResult } = result;
    return safeResult;
  }

  // ── MFA ───────────────────────────────────────────────────────────────────
  @Post('mfa/setup-totp')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  setupTotp(@Req() req: any) {
    return this.authService.setupTotp(req.user.id);
  }

  @Post('mfa/verify-totp')
  @HttpCode(HttpStatus.OK)
  verifyTotp(@Body() dto: VerifyMfaDto) {
    return this.authService.verifyAndEnableMfa(dto);
  }

  @Post('mfa/send-sms')
  @HttpCode(HttpStatus.OK)
  sendSmsOtp(@Body() dto: SendSmsOtpDto) {
    return this.authService.sendSmsMfaOtp(dto);
  }

  @Post('mfa/verify-sms')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  verifySmsOtp(@Body('otpCode') otpCode: string, @Req() req: any) {
    return this.authService.verifySmsMfaAndEnable(req.user.id, otpCode);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  disableMfa(@Body('totpCode') totpCode: string, @Req() req: any) {
    return this.authService.disableMfa(req.user.id, totpCode);
  }

  // ── GOOGLE OAUTH ──────────────────────────────────────────────────────────
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(@Query('tenantSlug') tenantSlug: string) {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { profile, tenantSlug } = req.user;
    const result = await this.authService.handleSocialLogin(
      profile,
      'GOOGLE',
      tenantSlug,
    );
    const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.redirect(`${frontendUrl}/auth/social-callback`);
  }

  // ── MICROSOFT OAUTH ───────────────────────────────────────────────────────
  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  microsoftAuth(@Query('tenantSlug') tenantSlug: string) {}

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  async microsoftCallback(@Req() req: any, @Res() res: Response) {
    const { profile, tenantSlug } = req.user;
    const result = await this.authService.handleSocialLogin(
      profile,
      'MICROSOFT',
      tenantSlug,
    );
    const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.redirect(`${frontendUrl}/auth/social-callback`);
  }
}
