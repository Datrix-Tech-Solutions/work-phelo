import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  InitiateOffboardDto,
  UpdateChecklistDto,
} from './dto/offboard-employee.dto';
import {
  DismissResignationDto,
  SubmitResignationDto,
} from './dto/resignation.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import {
  CreateEmployeeDeductionDto,
  UpdateEmployeeDeductionDto,
} from './dto/employee-deduction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  private assertEmployeeOptionsAccess(user: RequestUser) {
    assertHrAccess(
      isCompanyAdminUser(user) ||
        hasPermissionRule(user, 'employees:VIEW') ||
        hasPermissionRule(user, 'employees:CREATE') ||
        hasPermissionRule(user, 'employees:EDIT') ||
        hasPermissionRule(user, 'departments:CREATE') ||
        hasPermissionRule(user, 'departments:EDIT') ||
        hasPermissionRule(user, 'branches:CREATE') ||
        hasPermissionRule(user, 'branches:EDIT') ||
        hasPermissionRule(user, 'assets:VIEW') ||
        hasPermissionRule(user, 'assets:CREATE') ||
        hasPermissionRule(user, 'assets:EDIT') ||
        hasPermissionRule(user, 'assets:ASSIGN') ||
        hasPermissionRule(user, 'appraisals:VIEW') ||
        hasPermissionRule(user, 'appraisals:CREATE') ||
        hasPermissionRule(user, 'appraisal-settings:EDIT') ||
        hasPermissionRule(user, 'appraisal-reviews:EDIT') ||
        hasPermissionRule(user, 'schedules:VIEW') ||
        hasPermissionRule(user, 'schedules:CREATE') ||
        hasPermissionRule(user, 'schedules:EDIT') ||
        hasPermissionRule(user, 'schedules:APPROVE'),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CREATE_EMPLOYEE)
  @ApiOperation({ summary: 'Create a new employee profile' })
  @ApiBody({
    schema: {
      example: {
        firstName: 'Kofi',
        lastName: 'Boateng',
        email: 'kofi.boateng@acmeghana.com',
        phone: '+233244000003',
        gender: 'MALE',
        dateOfBirth: '1990-05-15',
        jobTitle: 'Software Engineer',
        employmentType: 'FULL_TIME',
        hireDate: '2024-01-15',
        basicSalary: 5000,
        departmentId: 'e9f919c4-6463-48a3-a6fa-a7afa36b88c7',
        bankName: 'GCB Bank',
        bankAccountNumber: '1234567890',
        ssnit: 'P00123456',
        tinNumber: 'P0012345678',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Employee already exists for this user',
  })
  create(@Body() dto: CreateEmployeeDto, @Req() req: any) {
    return this.employeesService.create(req.user.tenantId, dto);
  }

  @Get()
  @RequirePermissions(Permission.READ_EMPLOYEES)
  @ApiOperation({
    summary: 'List all employees — supports filtering and search',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'],
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
  findAll(@Query() query: QueryEmployeesDto, @Req() req: any) {
    return this.employeesService.findAll(
      req.user.tenantId,
      query,
      req.user as RequestUser,
    );
  }

  @Get('options')
  @ApiOperation({
    summary:
      'List lightweight employee options for selectors in the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee options retrieved successfully',
  })
  findOptions(@Req() req: any) {
    const user = req.user as RequestUser;
    this.assertEmployeeOptionsAccess(user);
    return this.employeesService.findOptions(user.tenantId);
  }

  @Get('me')
  @RequirePermissions(Permission.READ_OWN_PROFILE)
  @ApiOperation({ summary: 'Get the employee profile of the logged-in user' })
  @ApiResponse({ status: 200, description: 'Employee profile retrieved' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  getMyProfile(@Req() req: any) {
    return this.employeesService.findByUserId(req.user.tenantId, req.user.id);
  }

  @Patch('me')
  @RequirePermissions(Permission.UPDATE_OWN_PROFILE)
  @ApiOperation({
    summary: 'Update the employee profile of the logged-in user',
  })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee profile updated' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  updateMyProfile(@Body() dto: UpdateEmployeeDto, @Req() req: any) {
    return this.employeesService.updateMyProfile(
      req.user.tenantId,
      dto,
      req.user as RequestUser,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_EMPLOYEES)
  @ApiOperation({ summary: 'Get an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.findById(
      req.user.tenantId,
      id,
      req.user as RequestUser,
    );
  }

  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_EMPLOYEE)
  @ApiOperation({ summary: 'Update an employee profile' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: any,
  ) {
    return this.employeesService.update(
      req.user.tenantId,
      id,
      dto,
      req.user as RequestUser,
    );
  }

  @Post(':id/resignation')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SUBMIT_RESIGNATION)
  @ApiOperation({
    summary: 'Submit a resignation for the current employee profile',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({ type: SubmitResignationDto })
  @ApiResponse({ status: 201, description: 'Resignation submitted' })
  submitResignation(
    @Param('id') id: string,
    @Body() dto: SubmitResignationDto,
    @Req() req: any,
  ) {
    return this.employeesService.submitResignation(
      req.user.tenantId,
      id,
      dto,
      req.user as RequestUser,
    );
  }

  @Get(':id/resignation')
  @ApiOperation({
    summary: 'Get resignation record for an employee',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Resignation record retrieved' })
  getResignation(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.getResignationRecord(
      req.user.tenantId,
      id,
      req.user as RequestUser,
    );
  }

  @Delete(':id/resignation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WITHDRAW_RESIGNATION)
  @ApiOperation({
    summary: 'Withdraw a pending resignation before offboarding begins',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Resignation withdrawn' })
  withdrawResignation(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.withdrawResignation(
      req.user.tenantId,
      id,
      req.user as RequestUser,
    );
  }

  @Patch(':id/resignation/dismiss')
  @RequirePermissions(Permission.OFFBOARD_EMPLOYEE)
  @ApiOperation({
    summary: 'Dismiss a resignation without initiating offboarding',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({ type: DismissResignationDto })
  @ApiResponse({ status: 200, description: 'Resignation dismissed' })
  dismissResignation(
    @Param('id') id: string,
    @Body() dto: DismissResignationDto,
    @Req() req: any,
  ) {
    return this.employeesService.dismissResignation(
      req.user.tenantId,
      id,
      dto,
      req.user as RequestUser,
    );
  }

  @Post(':id/resignation/initiate-offboarding')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.OFFBOARD_EMPLOYEE)
  @ApiOperation({
    summary: 'Initiate offboarding from a pending resignation',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({
    status: 201,
    description: 'Offboarding initiated from resignation',
  })
  initiateOffboardingFromResignation(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.initiateOffboardFromResignation(
      req.user.tenantId,
      id,
      req.user as RequestUser,
    );
  }

  @Post(':id/offboard')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.OFFBOARD_EMPLOYEE)
  @ApiOperation({ summary: 'Initiate offboarding — creates a draft record' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({ type: InitiateOffboardDto })
  @ApiResponse({ status: 201, description: 'Offboarding record created' })
  initiateOffboard(
    @Param('id') id: string,
    @Body() dto: InitiateOffboardDto,
    @Req() req: any,
  ) {
    return this.employeesService.initiateOffboard(req.user.tenantId, id, dto);
  }

  @Get(':id/offboard')
  @RequirePermissions(Permission.OFFBOARD_EMPLOYEE)
  @ApiOperation({ summary: 'Get existing offboarding record for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Offboarding record retrieved' })
  getOffboardingRecord(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.getOffboardingRecord(
      req.user.tenantId,
      id,
      req.user as RequestUser,
    );
  }

  @Patch(':id/offboard/checklist')
  @RequirePermissions(Permission.OFFBOARD_EMPLOYEE)
  @ApiOperation({ summary: 'Tick or untick a clearance checklist item' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({ type: UpdateChecklistDto })
  @ApiResponse({ status: 200, description: 'Checklist item updated' })
  updateChecklist(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
    @Req() req: any,
  ) {
    return this.employeesService.updateOffboardChecklist(
      req.user.tenantId,
      id,
      dto,
      { id: req.user.id, email: req.user.email },
    );
  }

  @Post(':id/offboard/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OFFBOARD_EMPLOYEE)
  @ApiOperation({
    summary:
      'Complete offboarding — sets employee to Offboarded and revokes access',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Offboarding completed' })
  completeOffboard(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.completeOffboard(req.user.tenantId, id, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CREATE_EMPLOYEE)
  @ApiOperation({
    summary: 'Resend invite email to employee — invalidates previous link',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Invite resent successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  resendInvite(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.resendInvite(req.user.tenantId, id);
  }

  @Post(':id/allowances')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CREATE_EMPLOYEE)
  @ApiOperation({ summary: 'Add an allowance to an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({
    schema: {
      example: {
        type: 'TRANSPORT',
        amount: 500,
        description: 'Monthly transport allowance',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Allowance added successfully' })
  addAllowance(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.employeesService.addAllowance(req.user.tenantId, id, dto);
  }

  @Get(':id/deductions')
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({ summary: 'List payroll deductions for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee deductions retrieved' })
  listDeductions(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.listDeductions(req.user.tenantId, id);
  }

  @Post(':id/deductions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({ summary: 'Add a payroll deduction to an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({ type: CreateEmployeeDeductionDto })
  @ApiResponse({ status: 201, description: 'Deduction added successfully' })
  addDeduction(
    @Param('id') id: string,
    @Body() dto: CreateEmployeeDeductionDto,
    @Req() req: any,
  ) {
    return this.employeesService.addDeduction(req.user.tenantId, id, dto);
  }

  @Patch(':id/deductions/:deductionId')
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({ summary: 'Update a payroll deduction for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiParam({ name: 'deductionId', description: 'Deduction UUID' })
  @ApiBody({ type: UpdateEmployeeDeductionDto })
  @ApiResponse({ status: 200, description: 'Deduction updated successfully' })
  updateDeduction(
    @Param('id') id: string,
    @Param('deductionId') deductionId: string,
    @Body() dto: UpdateEmployeeDeductionDto,
    @Req() req: any,
  ) {
    return this.employeesService.updateDeduction(
      req.user.tenantId,
      id,
      deductionId,
      dto,
    );
  }

  @Delete(':id/deductions/:deductionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({
    summary: 'Delete an unpaid payroll deduction for an employee',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiParam({ name: 'deductionId', description: 'Deduction UUID' })
  @ApiResponse({ status: 204, description: 'Deduction deleted successfully' })
  async deleteDeduction(
    @Param('id') id: string,
    @Param('deductionId') deductionId: string,
    @Req() req: any,
  ) {
    await this.employeesService.deleteDeduction(
      req.user.tenantId,
      id,
      deductionId,
    );
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MANAGE_DOCUMENTS)
  @ApiOperation({ summary: 'Upload a document for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({
    schema: {
      example: {
        type: 'CONTRACT',
        url: 'https://storage.example.com/contracts/employee-123.pdf',
        name: 'Employment Contract 2026',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  uploadDocument(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.employeesService.uploadDocument(req.user.tenantId, id, dto);
  }
}
