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
import { OffboardEmployeeDto } from './dto/offboard-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new employee profile' })
  @ApiBody({
    examples: {
      kofi: {
        summary: 'Create Kofi Boateng',
        value: {
          userId: 'b23af225-01e8-45c1-9509-2caf8872b82c',
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
      ama: {
        summary: 'Create Ama Owusu',
        value: {
          userId: 'c312a870-9c17-45ae-bc3f-48848b6aa020',
          firstName: 'Ama',
          lastName: 'Owusu',
          email: 'ama.owusu@acmeghana.com',
          phone: '+233244000004',
          gender: 'FEMALE',
          dateOfBirth: '1993-08-22',
          jobTitle: 'HR Officer',
          employmentType: 'FULL_TIME',
          hireDate: '2024-03-01',
          basicSalary: 4000,
          departmentId: 'e9f919c4-6463-48a3-a6fa-a7afa36b88c7',
        },
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
    return this.employeesService.findAll(req.user.tenantId, query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the employee profile of the logged-in user' })
  @ApiResponse({ status: 200, description: 'Employee profile retrieved' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  getMyProfile(@Req() req: any) {
    return this.employeesService.findByUserId(req.user.tenantId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
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
    return this.employeesService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/offboard')
  @ApiOperation({ summary: 'Offboard an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiBody({ type: OffboardEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee offboarded successfully' })
  offboard(
    @Param('id') id: string,
    @Body() dto: OffboardEmployeeDto,
    @Req() req: any,
  ) {
    return this.employeesService.offboard(req.user.tenantId, id, dto);
  }

  @Post(':id/allowances')
  @HttpCode(HttpStatus.CREATED)
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

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
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
