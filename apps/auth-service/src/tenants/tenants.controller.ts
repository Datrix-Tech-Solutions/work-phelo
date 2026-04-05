import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new company — SuperAdmin only' })
  @ApiResponse({
    status: 201,
    description: 'Tenant created — OTP sent to admin email for verification',
    schema: {
      example: {
        message:
          'Registration submitted. Check your email for verification code.',
        tenantId: 'uuid',
        tenantName: 'Acme Ghana Ltd',
        tenantSlug: 'acme-ghana',
        workspaceUrl: 'http://157.245.220.205/acme-ghana/login',
        userId: 'uuid',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email or slug already exists' })
  @ApiBody({
    description: 'Tenant registration payload',
    schema: {
      example: {
        name: 'Acme Ghana Ltd',
        slug: 'acme-ghana',
        email: 'admin@acmeghana.com',
        password: 'Admin123!',
        firstName: 'Abena',
        lastName: 'Mensah',
        phone: '+233244111001',
        country: 'GH',
        industry: 'Manufacturing',
        size: '100-500',
      },
    },
  })
  register(@Body() dto: CreateTenantDto) {
    return this.tenantsService.register(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List tenants — SuperAdmin sees all, Tenant Admin sees own only',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED'],
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Tenants list' })
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const tenantId = isSuperAdmin ? undefined : req.user?.tenantId;
    return this.tenantsService.findAll({ status, search, tenantId });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve pending tenant — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant approved successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  approve(@Param('id') id: string) {
    return this.tenantsService.approveTenant(id);
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Suspend active tenant — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant suspended successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  suspend(@Param('id') id: string) {
    return this.tenantsService.suspendTenant(id);
  }

  @Patch(':id/modules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update module configuration for a company' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiBody({
    schema: {
      example: { hr: true, accounting: false, marketing: true },
    },
  })
  @ApiResponse({ status: 200, description: 'Module config updated' })
  updateModules(
    @Param('id') id: string,
    @Body() dto: Record<string, boolean>,
    @Req() req: any,
  ) {
    return this.tenantsService.updateModules(id, dto, req.user.id);
  }

  @Post(':id/admin/resend-invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invite to Company Admin — SuperAdmin only' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Invite resent successfully' })
  @ApiResponse({
    status: 404,
    description: 'No pending admin found for this company',
  })
  async resendAdminInvite(@Param('id') tenantId: string) {
    return this.tenantsService.resendAdminInvite(tenantId);
  }
}
