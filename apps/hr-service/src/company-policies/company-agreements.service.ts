import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyAgreementDto } from './dto/create-company-agreement.dto';

@Injectable()
export class CompanyAgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.companyAgreement.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async create(
    tenantId: string,
    dto: CreateCompanyAgreementDto,
    createdBy?: string | null,
  ) {
    return this.prisma.companyAgreement.create({
      data: {
        tenantId,
        type: dto.type,
        title: dto.title.trim(),
        details: dto.details.trim(),
        createdBy: createdBy ?? null,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.companyAgreement.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Company agreement not found');
    }

    await this.prisma.companyAgreement.delete({
      where: { id },
    });

    return { message: 'Company agreement deleted successfully' };
  }
}
