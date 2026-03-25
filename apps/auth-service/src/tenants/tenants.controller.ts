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

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new company and admin user' })
  @ApiResponse({
    status: 201,
    description: 'Tenant created — email OTP sent for verification',
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
}
