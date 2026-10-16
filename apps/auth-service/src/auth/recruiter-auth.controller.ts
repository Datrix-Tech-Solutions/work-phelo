import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { RecruiterAuthService } from './recruiter-auth.service';
import { RegisterRecruiterDto } from './dto/register-recruiter.dto';
import { RecruiterLoginDto } from './dto/recruiter-login.dto';
import {
  RecruiterConfirmEmailDto,
  RecruiterResendConfirmationDto,
} from './dto/recruiter-email.dto';

@ApiTags('Recruiter Auth')
@Controller('recruiters')
export class RecruiterAuthController {
  constructor(private readonly recruiters: RecruiterAuthService) {}

  @Post('register')
  @Throttle({
    short: { limit: 2, ttl: 60_000 },
    medium: { limit: 5, ttl: 3_600_000 },
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a recruiter from the careers site',
    description:
      'Creates a restricted company account (job openings and applicants only) and emails a confirmation link to the careers site.',
  })
  @ApiResponse({ status: 201, description: 'Confirmation email queued' })
  @ApiResponse({ status: 409, description: 'Account details unavailable' })
  register(@Body() dto: RegisterRecruiterDto) {
    return this.recruiters.register(dto);
  }

  @Post('confirm-email')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a recruiter email from the emailed link' })
  confirmEmail(@Body() dto: RecruiterConfirmEmailDto) {
    return this.recruiters.confirmEmail(dto.token);
  }

  @Post('resend-confirmation')
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    medium: { limit: 10, ttl: 3_600_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the recruiter confirmation email' })
  resendConfirmation(@Body() dto: RecruiterResendConfirmationDto) {
    return this.recruiters.resendConfirmation(dto.email);
  }

  @Post('login')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recruiter login with email and password',
    description:
      'Server-to-server login for the careers site. Tokens are returned in the body so the site can keep them in its own cookies.',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({
    status: 403,
    description: 'Email not confirmed or account blocked',
  })
  login(@Body() dto: RecruiterLoginDto, @Req() req: Request) {
    return this.recruiters.login(dto, req.ip, req.headers['user-agent']);
  }
}
