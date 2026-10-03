import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingFleetVehicle } from '../../prisma/generated/client';
import { callHr } from '../hr/call-hr';
import { PrismaService } from '../prisma/prisma.service';
import { TransportOfficersService } from '../transport-officers/transport-officers.service';
import {
  CreateFleetVehicleDto,
  QueryFleetVehiclesDto,
  SettableFleetStatus,
  UpdateFleetVehicleDto,
} from './dto/fleet.dto';
import { HrFleetClient, HrVehicleAsset } from './hr-fleet.client';

const EMPTY_PATCH_MESSAGE = 'At least one field is required';
const MAINTENANCE_WITH_DRIVER_MESSAGE =
  'A vehicle in maintenance cannot be assigned a driver';
const DETAIL_FIELDS = [
  'vehicleType',
  'make',
  'model',
  'yearOfRegistration',
  'fuelType',
  'currentMileage',
] as const;
/** Everything but mileage must be present the first time details are saved. */
const REQUIRED_DETAIL_FIELDS = DETAIL_FIELDS.filter(
  (key) => key !== 'currentMileage',
);

type FleetDetails = Pick<MarketingFleetVehicle, (typeof DETAIL_FIELDS)[number]>;

/**
 * Fleet = HR vehicle assets (identity, branch, driver, status) merged with the
 * fleet-specific details this service owns. A vehicle created in HR shows up
 * here with needsFleetDetails=true until its details are filled in.
 */
@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hr: HrFleetClient,
    private readonly officers: TransportOfficersService,
  ) {}

  async list(user: RequestUser, query: QueryFleetVehiclesDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.toLowerCase();

    const [assets, details] = await Promise.all([
      this.callHr(() => this.hr.listVehicles(user.tenantId)),
      this.prisma.marketingFleetVehicle.findMany({
        where: { tenantId: user.tenantId },
      }),
    ]);
    const detailsByAsset = new Map(details.map((row) => [row.assetId, row]));

    const rows = assets
      .map((asset) => this.toRow(asset, detailsByAsset.get(asset.id)))
      .filter((row) => {
        if (query.status && row.status !== query.status) return false;
        if (query.branchId && row.branch?.id !== query.branchId) return false;
        if (query.vehicleType && row.vehicleType !== query.vehicleType) {
          return false;
        }
        if (query.fuelType && row.fuelType !== query.fuelType) return false;
        if (!search) return true;
        return [
          row.make,
          row.model,
          row.assetNumber,
          row.name,
          row.assignedDriver?.name,
        ].some((value) => value?.toLowerCase().includes(search));
      });

    const total = rows.length;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Branches come from HR; drivers are the tenant's active transport officers. */
  async options(user: RequestUser) {
    const [hrOptions, drivers] = await Promise.all([
      this.callHr(() => this.hr.getOptions(user.tenantId)),
      this.officers.activeDrivers(user.tenantId),
    ]);
    return {
      branches: hrOptions.branches,
      drivers: drivers.map((driver) => ({
        id: driver.employeeId,
        name: driver.name,
      })),
    };
  }

  async findOne(user: RequestUser, assetId: string) {
    const asset = await this.callHr(() =>
      this.hr.getVehicle(user.tenantId, assetId),
    );
    return this.toRow(asset, await this.findDetails(user.tenantId, assetId));
  }

  async create(user: RequestUser, dto: CreateFleetVehicleDto) {
    if (dto.status === 'MAINTENANCE' && dto.assignedDriverId) {
      throw new BadRequestException(MAINTENANCE_WITH_DRIVER_MESSAGE);
    }

    if (dto.assignedDriverId) {
      await this.officers.assertActiveOfficer(
        user.tenantId,
        dto.assignedDriverId,
      );
    }

    const asset = await this.callHr(() =>
      this.hr.createVehicle(user.tenantId, {
        name: this.vehicleName(dto.make, dto.model),
        branchId: dto.branchId,
      }),
    );

    // The asset already exists in HR at this point. If saving the details
    // fails the vehicle still lists as "needs fleet details", so a retry via
    // the update route completes it instead of creating a duplicate.
    const details = await this.prisma.marketingFleetVehicle.create({
      data: {
        tenantId: user.tenantId,
        assetId: asset.id,
        ...(this.pickDetails(dto) as FleetDetails),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });

    const warnings: string[] = [];
    let current = asset;
    if (dto.status === 'MAINTENANCE') {
      current = await this.bestEffort(
        () => this.hr.setStatus(user.tenantId, asset.id, 'MAINTENANCE'),
        current,
        'Vehicle created, but it could not be set to maintenance',
        warnings,
      );
    }
    if (dto.assignedDriverId) {
      current = await this.bestEffort(
        () =>
          this.hr.assignDriver(user.tenantId, asset.id, dto.assignedDriverId),
        current,
        'Vehicle created, but the driver could not be assigned',
        warnings,
      );
    }

    return { ...this.toRow(current, details), warnings };
  }

  async update(user: RequestUser, assetId: string, dto: UpdateFleetVehicleDto) {
    const detailPatch = this.pickDetails(dto);
    if (!Object.keys(detailPatch).length && dto.branchId === undefined) {
      throw new BadRequestException(EMPTY_PATCH_MESSAGE);
    }

    const asset = await this.callHr(() =>
      this.hr.getVehicle(user.tenantId, assetId),
    );
    const existing = await this.findDetails(user.tenantId, assetId);

    if (!existing) {
      const missing = REQUIRED_DETAIL_FIELDS.filter(
        (key) => detailPatch[key] == null,
      );
      if (Object.keys(detailPatch).length && missing.length) {
        throw new BadRequestException(
          `Fleet details are incomplete: ${missing.join(', ')} required`,
        );
      }
    }

    // HR first: if the branch is rejected nothing has been saved here yet.
    let current = asset;
    const hrPatch: { name?: string; branchId?: string | null } = {};
    if (dto.branchId !== undefined) hrPatch.branchId = dto.branchId;
    if (existing && (dto.make !== undefined || dto.model !== undefined)) {
      // Only follow make/model renames while the asset still has the name we generated.
      if (asset.name === this.vehicleName(existing.make, existing.model)) {
        hrPatch.name = this.vehicleName(
          dto.make ?? existing.make,
          dto.model ?? existing.model,
        );
      }
    }
    if (Object.keys(hrPatch).length) {
      current = await this.callHr(() =>
        this.hr.updateVehicle(user.tenantId, assetId, hrPatch),
      );
    }

    let details = existing;
    if (Object.keys(detailPatch).length) {
      details = await this.prisma.marketingFleetVehicle.upsert({
        where: { tenantId_assetId: { tenantId: user.tenantId, assetId } },
        create: {
          tenantId: user.tenantId,
          assetId,
          ...(detailPatch as FleetDetails),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        update: { ...detailPatch, updatedByUserId: user.id },
      });
    }

    return this.toRow(current, details);
  }

  async setStatus(
    user: RequestUser,
    assetId: string,
    status: SettableFleetStatus,
  ) {
    const asset = await this.callHr(() =>
      this.hr.setStatus(user.tenantId, assetId, status),
    );
    return this.toRow(asset, await this.findDetails(user.tenantId, assetId));
  }

  async assignDriver(user: RequestUser, assetId: string, employeeId: string) {
    await this.officers.assertActiveOfficer(user.tenantId, employeeId);
    const asset = await this.callHr(() =>
      this.hr.assignDriver(user.tenantId, assetId, employeeId),
    );
    return this.toRow(asset, await this.findDetails(user.tenantId, assetId));
  }

  async unassignDriver(user: RequestUser, assetId: string) {
    const asset = await this.callHr(() =>
      this.hr.unassignDriver(user.tenantId, assetId),
    );
    return this.toRow(asset, await this.findDetails(user.tenantId, assetId));
  }

  /**
   * Removes a vehicle from active service: frees its driver and retires the HR
   * asset. The asset and its assignment history are kept, so HR records stay
   * intact; the fleet details row is kept for the same reason.
   */
  async remove(user: RequestUser, assetId: string) {
    const asset = await this.callHr(() =>
      this.hr.getVehicle(user.tenantId, assetId),
    );
    if (asset.status === 'RETIRED') return { success: true };

    if (asset.assignedEmployeeId) {
      await this.callHr(() => this.hr.unassignDriver(user.tenantId, assetId));
    }
    await this.callHr(() =>
      this.hr.setStatus(user.tenantId, assetId, 'RETIRED'),
    );
    return { success: true };
  }

  private findDetails(tenantId: string, assetId: string) {
    return this.prisma.marketingFleetVehicle.findUnique({
      where: { tenantId_assetId: { tenantId, assetId } },
    });
  }

  private vehicleName(make: string, model: string) {
    return `${make} ${model}`.trim();
  }

  private pickDetails(source: Partial<FleetDetails>): Partial<FleetDetails> {
    const picked: Partial<FleetDetails> = {};
    for (const key of DETAIL_FIELDS) {
      if (source[key] !== undefined) {
        (picked as Record<string, unknown>)[key] = source[key];
      }
    }
    return picked;
  }

  private toRow(asset: HrVehicleAsset, details?: FleetDetails | null) {
    return {
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      name: asset.name,
      vehicleType: details?.vehicleType ?? null,
      make: details?.make ?? null,
      model: details?.model ?? null,
      yearOfRegistration: details?.yearOfRegistration ?? null,
      fuelType: details?.fuelType ?? null,
      currentMileage: details?.currentMileage ?? null,
      branch: asset.branchId
        ? { id: asset.branchId, name: asset.branchName ?? null }
        : null,
      assignedDriver: asset.assignedEmployeeId
        ? {
            id: asset.assignedEmployeeId,
            name: asset.assignedEmployeeName ?? null,
          }
        : null,
      status: asset.status,
      needsFleetDetails: !details,
      createdAt: asset.createdAt,
    };
  }

  private async bestEffort(
    action: () => Promise<HrVehicleAsset>,
    fallback: HrVehicleAsset,
    message: string,
    warnings: string[],
  ) {
    try {
      return await action();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'unexpected error';
      this.logger.warn(`${message}: ${reason}`);
      warnings.push(`${message}: ${reason}`);
      return fallback;
    }
  }

  private callHr<T>(action: () => Promise<T>): Promise<T> {
    return callHr(
      this.logger,
      action,
      'Fleet vehicles are temporarily unavailable. Please try again.',
    );
  }
}
