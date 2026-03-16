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

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEmployeeDto, @Req() req: any) {
    return this.employeesService.create(req.user.tenantId, dto);
  }

  @Get()
  findAll(@Query() query: QueryEmployeesDto, @Req() req: any) {
    return this.employeesService.findAll(req.user.tenantId, query);
  }

  @Get('me')
  getMyProfile(@Req() req: any) {
    return this.employeesService.findByUserId(req.user.tenantId, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: any,
  ) {
    return this.employeesService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/offboard')
  offboard(
    @Param('id') id: string,
    @Body() dto: OffboardEmployeeDto,
    @Req() req: any,
  ) {
    return this.employeesService.offboard(req.user.tenantId, id, dto);
  }

  @Post(':id/allowances')
  @HttpCode(HttpStatus.CREATED)
  addAllowance(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.employeesService.addAllowance(req.user.tenantId, id, dto);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  uploadDocument(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.employeesService.uploadDocument(req.user.tenantId, id, dto);
  }
}
