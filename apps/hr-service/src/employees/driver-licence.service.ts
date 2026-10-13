import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType } from '../../prisma/generated/client';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDriverLicenceDto,
  UpdateDriverLicenceDto,
} from './dto/driver-licence.dto';
import { licenceAbility, todayIso } from './driver-licence.util';

/** "YYYY-MM-DD" -> a Date at UTC midnight, matching how @db.Date columns round-trip. */
const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
const fromDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Driver's licence details and the "can this person drive themselves" answer. The ability needs
 * both the unexpired licence record and at least one DRIVER_LICENCE image on file, so removing
 * the image takes it away without touching the details.
 */
@Injectable()
export class DriverLicenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  private async imageOnFile(tenantId: string, employeeId: string) {
    const count = await this.prisma.employeeDocument.count({
      where: { tenantId, employeeId, type: DocumentType.DRIVER_LICENCE },
    });
    return count > 0;
  }

  private async view(
    tenantId: string,
    employeeId: string,
    onDate: string = todayIso(),
  ) {
    const [row, imageOnFile] = await Promise.all([
      this.prisma.employeeDriverLicence.findFirst({
        where: { tenantId, employeeId },
      }),
      this.imageOnFile(tenantId, employeeId),
    ]);
    const expiresAt = row ? fromDate(row.expiresAt) : null;
    return {
      licence: row
        ? {
            id: row.id,
            licenceNumber: this.encryption.decrypt(row.licenceNumber) ?? '',
            issuedAt: fromDate(row.issuedAt),
            expiresAt: fromDate(row.expiresAt),
          }
        : null,
      imageOnFile,
      ...licenceAbility({ expiresAt, imageOnFile, onDate }),
    };
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }

  async employeeIdForUser(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return employee.id;
  }

  async get(tenantId: string, employeeId: string) {
    await this.assertEmployee(tenantId, employeeId);
    return this.view(tenantId, employeeId);
  }

  async create(
    tenantId: string,
    employeeId: string,
    dto: CreateDriverLicenceDto,
  ) {
    await this.assertEmployee(tenantId, employeeId);
    this.assertDates(dto.issuedAt, dto.expiresAt);

    // The image has to be uploaded first, so a licence can't be claimed with nothing behind it.
    if (!(await this.imageOnFile(tenantId, employeeId))) {
      throw new BadRequestException(
        "Upload an image of the driver's licence before adding its details.",
      );
    }
    const existing = await this.prisma.employeeDriverLicence.findFirst({
      where: { tenantId, employeeId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        "A driver's licence is already on record. Update it instead.",
      );
    }

    await this.prisma.employeeDriverLicence.create({
      data: {
        tenantId,
        employeeId,
        licenceNumber: this.encryption.encrypt(dto.licenceNumber) as string,
        issuedAt: toDate(dto.issuedAt),
        expiresAt: toDate(dto.expiresAt),
      },
    });
    return this.view(tenantId, employeeId);
  }

  async update(
    tenantId: string,
    employeeId: string,
    dto: UpdateDriverLicenceDto,
  ) {
    const existing = await this.prisma.employeeDriverLicence.findFirst({
      where: { tenantId, employeeId },
    });
    if (!existing) {
      throw new NotFoundException("No driver's licence is on record");
    }
    const issuedAt = dto.issuedAt?.slice(0, 10) ?? fromDate(existing.issuedAt);
    const expiresAt =
      dto.expiresAt?.slice(0, 10) ?? fromDate(existing.expiresAt);
    this.assertDates(issuedAt, expiresAt);

    await this.prisma.employeeDriverLicence.update({
      where: { id: existing.id },
      data: {
        ...(dto.licenceNumber !== undefined
          ? {
              licenceNumber: this.encryption.encrypt(
                dto.licenceNumber,
              ) as string,
            }
          : {}),
        issuedAt: toDate(issuedAt),
        expiresAt: toDate(expiresAt),
      },
    });
    return this.view(tenantId, employeeId);
  }

  /**
   * For other services: can this user drive themselves on `onDate`? Users with no employee record
   * (e.g. tenant admins) are not covered by the rule and are reported as such.
   */
  async checkForUser(tenantId: string, userId: string, onDate?: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId },
      select: { id: true },
    });
    if (!employee) {
      return {
        hasEmployeeRecord: false,
        canDrive: true,
        status: 'NONE' as const,
        expiresAt: null,
        daysLeft: null,
        imageOnFile: false,
      };
    }
    const view = await this.view(tenantId, employee.id, onDate);
    return {
      hasEmployeeRecord: true,
      canDrive: view.canDrive,
      status: view.status,
      expiresAt: view.licence?.expiresAt ?? null,
      daysLeft: view.daysLeft,
      imageOnFile: view.imageOnFile,
    };
  }

  private assertDates(issuedAt: string, expiresAt: string) {
    const issued = issuedAt.slice(0, 10);
    const expires = expiresAt.slice(0, 10);
    if (issued > todayIso()) {
      throw new BadRequestException('The issue date cannot be in the future.');
    }
    if (expires <= issued) {
      throw new BadRequestException(
        'The expiry date must be after the issue date.',
      );
    }
  }
}
