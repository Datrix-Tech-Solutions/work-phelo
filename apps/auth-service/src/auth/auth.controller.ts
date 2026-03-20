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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful — tokens set as HTTP-only cookies',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({
    status: 403,
    description: 'Tenant suspended or user inactive',
  })
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
    if ('requiresMfa' in result || 'requiresPasswordReset' in result)
      return result;
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const { accessToken, refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SuperAdmin login (platform owner only)' })
  @ApiBody({
    schema: {
      properties: { email: { type: 'string' }, password: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or not a SuperAdmin',
  })
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
  @ApiOperation({ summary: 'Verify email with OTP sent on registration' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification OTP' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh_token cookie' })
  @ApiResponse({ status: 200, description: 'Tokens rotated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken)
      return res.status(401).json({ message: 'No refresh token provided' });
    const result = await this.authService.refresh({ refreshToken });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { message: 'Tokens refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout current device — clears cookies and revokes refresh token',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) await this.authService.logout(refreshToken);
    clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout all devices — revokes all refresh tokens' })
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(req.user.id);
    clearAuthCookies(res);
    return { message: 'Logged out from all devices' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset via email link or SMS OTP' })
  @ApiResponse({ status: 200, description: 'Reset instructions sent' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using email link token or SMS OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password — requires current password' })
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @Post('force-reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Force reset — used when login returns requiresPasswordReset: true',
  })
  async forceResetPassword(
    @Body() dto: ForceResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.forceResetPassword(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const { accessToken, refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @Post('mfa/setup-totp')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Setup TOTP MFA — returns QR code and secret' })
  setupTotp(@Req() req: any) {
    return this.authService.setupTotp(req.user.id);
  }

  @Post('mfa/verify-totp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP code and enable MFA' })
  verifyTotp(@Body() dto: VerifyMfaDto) {
    return this.authService.verifyAndEnableMfa(dto);
  }

  @Post('mfa/send-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send SMS OTP to registered phone number' })
  sendSmsOtp(@Body() dto: SendSmsOtpDto) {
    return this.authService.sendSmsMfaOtp(dto);
  }

  @Post('mfa/verify-sms')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify SMS OTP and enable SMS MFA' })
  verifySmsOtp(@Body('otpCode') otpCode: string, @Req() req: any) {
    return this.authService.verifySmsMfaAndEnable(req.user.id, otpCode);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable MFA' })
  disableMfa(@Body('totpCode') totpCode: string, @Req() req: any) {
    return this.authService.disableMfa(req.user.id, totpCode);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth — open in browser only' })
  googleAuth(@Query('tenantSlug') tenantSlug: string) {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
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

  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ summary: 'Initiate Microsoft OAuth — open in browser only' })
  microsoftAuth(@Query('tenantSlug') tenantSlug: string) {}

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
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
