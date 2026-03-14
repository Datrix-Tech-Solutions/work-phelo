import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { MicrosoftAuthGuard } from './guards/microsoft-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── STANDARD AUTH ─────────────────────────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  adminLogin(
    @Body() body: { email: string; password: string },
    @Req() req: any,
  ) {
    return this.authService.adminLogin(
      body.email,
      body.password,
      req.ip,
      req.headers['user-agent'],
    );
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

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logoutAll(@Req() req: any) {
    return this.authService.logoutAll(req.user.id);
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
  forceResetPassword(@Body() dto: ForceResetPasswordDto) {
    return this.authService.forceResetPassword(dto);
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
  googleAuth(@Query('tenantSlug') tenantSlug: string) {
    // Passport redirects to Google — tenantSlug passed as state
  }

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
    res.redirect(
      `${frontendUrl}/auth/social-callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
    );
  }

  // ── MICROSOFT OAUTH ───────────────────────────────────────────────────────
  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  microsoftAuth(@Query('tenantSlug') tenantSlug: string) {
    // Passport redirects to Microsoft
  }

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
    res.redirect(
      `${frontendUrl}/auth/social-callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
    );
  }
}
