import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { LeaveService } from '../leave/leave.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { OffboardEmployeeDto } from './dto/offboard-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { paginationParams, paginate } from '../common/response.helper';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveService: LeaveService,
  ) {}

  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Enforce minimum one department before adding employees
    const deptCount = await this.prisma.department.count({
      where: { tenantId, isActive: true },
    });
    if (deptCount === 0) {
      throw new BadRequestException(
        'Please set up at least one department before adding employees.',
      );
    }

    const existing = await this.prisma.employee.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing)
      throw new ConflictException('Employee with this email already exists');

    const count = await this.prisma.employee.count({ where: { tenantId } });
    const employeeNumber = `EMP-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.employee.create({
      data: {
        tenantId,
        employeeNumber,
        ...dto,
        basicSalary: dto.basicSalary,
        hireDate: new Date(dto.hireDate),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        probationEndsAt: dto.probationEndsAt
          ? new Date(dto.probationEndsAt)
          : undefined,
      },
      include: { department: true },
    });
  }

  async findAll(tenantId: string, query: QueryEmployeesDto) {
    const { take, skip } = paginationParams(query.page, query.limit);

    const where: any = { tenantId };
    if (query.status) where.employmentStatus = query.status;
    if (query.type) where.employmentType = query.type;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeNumber: { contains: query.search, mode: 'insensitive' } },
        { jobTitle: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        take,
        skip,
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          employmentStatus: true,
          employmentType: true,
          hireDate: true,
          avatarUrl: true,
          department: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { employees, meta: paginate(total, query.page || 1, take) };
  }

  async findById(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        department: true,
        allowances: true,
        documents: true,
        leaveBalances: { include: { leaveType: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async findByUserId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
      include: { department: true, allowances: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return employee;
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findById(tenantId, id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
      include: { department: true },
    });
  }

  async offboard(tenantId: string, id: string, dto: OffboardEmployeeDto) {
    const employee = await this.findById(tenantId, id);
    if (employee.employmentStatus === 'OFFBOARDED') {
      throw new BadRequestException('Employee is already offboarded');
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        employmentStatus: 'OFFBOARDED',
        offboardedAt: new Date(dto.offboardedAt),
        offboardReason: dto.reason,
      },
    });
  }

  async addAllowance(tenantId: string, employeeId: string, dto: any) {
    await this.findById(tenantId, employeeId);
    return this.prisma.employeeAllowance.create({
      data: {
        tenantId,
        employeeId,
        ...dto,
        effectiveFrom: new Date(dto.effectiveFrom),
      },
    });
  }

  async uploadDocument(tenantId: string, employeeId: string, dto: any) {
    await this.findById(tenantId, employeeId);
    return this.prisma.employeeDocument.create({
      data: { tenantId, employeeId, ...dto },
    });
  }
}
