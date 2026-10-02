import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { RequestUser } from '@work-phelo/types';
import { MarketingFleetVehicle } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
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

  options(user: RequestUser) {
    return this.callHr(() => this.hr.getOptions(user.tenantId));
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
      const missing = DETAIL_FIELDS.filter((key) => detailPatch[key] == null);
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

  /** Passes HR validation errors through; hides outages and service-auth problems. */
  private async callHr<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof InternalServiceClientError)) throw error;
      const status = error.statusCode;
      const passThrough =
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        ![401, 403, 408, 429].includes(status);
      if (passThrough) throw new HttpException(error.message, status);

      this.logger.error(`hr-service call failed: ${error.message}`);
      throw new BadGatewayException({
        statusCode: 502,
        error: 'Bad Gateway',
        message:
          'Fleet vehicles are temporarily unavailable. Please try again.',
        // Coarse, secret-free hint so a failure can be diagnosed without server logs.
        reason: this.failureReason(error),
      });
    }
  }

  private failureReason(error: InternalServiceClientError) {
    const status = error.statusCode;
    if (status === 401 || status === 403)
      return 'HR_SERVICE_REJECTED_CREDENTIALS';
    if (status !== undefined) return `HR_SERVICE_ERROR_${status}`;
    // No HTTP status: either we never sent the request (config) or it never arrived.
    return error.retryable
      ? 'HR_SERVICE_UNREACHABLE'
      : 'HR_SERVICE_NOT_CONFIGURED';
  }
}
