import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingFleetVehicle } from '../../prisma/generated/client';
import { callHr } from '../hr/call-hr';
import { PrismaService } from '../prisma/prisma.service';
import { TransportOfficersService } from '../transport-officers/transport-officers.service';
import { TripHistoryQueryDto } from '../trips/dto/trip-history-query.dto';
import { strongestState } from '../trips/trip-schedule';
import {
  ScheduledTrip,
  TripScheduleService,
  tripsForVehicle,
} from '../trips/trip-schedule.service';
import {
  CreateFleetVehicleDto,
  FleetStatus,
  QueryFleetVehiclesDto,
  SettableFleetStatus,
  UpdateFleetVehicleDto,
} from './dto/fleet.dto';
import { HrFleetClient, HrVehicleAsset } from './hr-fleet.client';

const EMPTY_PATCH_MESSAGE = 'At least one field is required';
const ON_TRIP_MESSAGE =
  'This vehicle is on a trip right now. Try again once it is back.';
/** How many booked/on-route trips a vehicle row carries. */
const MAX_TRIPS_PER_ROW = 10;
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
    private readonly trips: TripScheduleService,
  ) {}

  async list(user: RequestUser, query: QueryFleetVehiclesDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.toLowerCase();

    const [assets, details, trips] = await Promise.all([
      this.callHr(() => this.hr.listVehicles(user.tenantId)),
      this.prisma.marketingFleetVehicle.findMany({
        where: { tenantId: user.tenantId },
      }),
      this.trips.activeTrips(user.tenantId),
    ]);
    const detailsByAsset = new Map(details.map((row) => [row.assetId, row]));

    const rows = assets
      .map((asset) =>
        this.toRow(
          asset,
          detailsByAsset.get(asset.id),
          tripsForVehicle(trips, asset.id),
        ),
      )
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

  /** Completed trips this vehicle has been on, most recent first. */
  tripHistory(user: RequestUser, assetId: string, query: TripHistoryQueryDto) {
    return this.trips.completedTrips(
      user.tenantId,
      { vehicleAssetId: assetId },
      query.page,
      query.limit,
    );
  }

  async findOne(user: RequestUser, assetId: string) {
    const asset = await this.callHr(() =>
      this.hr.getVehicle(user.tenantId, assetId),
    );
    return this.rowFor(user.tenantId, asset);
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

    return {
      ...(await this.rowFor(user.tenantId, current, details)),
      warnings,
    };
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

    return this.rowFor(user.tenantId, current, details);
  }

  async setStatus(
    user: RequestUser,
    assetId: string,
    status: SettableFleetStatus,
  ) {
    if (status !== 'AVAILABLE')
      await this.assertNotOnTrip(user.tenantId, assetId);
    const asset = await this.callHr(() =>
      this.hr.setStatus(user.tenantId, assetId, status),
    );
    return this.rowFor(user.tenantId, asset);
  }

  async assignDriver(user: RequestUser, assetId: string, employeeId: string) {
    await this.officers.assertActiveOfficer(user.tenantId, employeeId);
    const asset = await this.callHr(() =>
      this.hr.assignDriver(user.tenantId, assetId, employeeId),
    );
    return this.rowFor(user.tenantId, asset);
  }

  async unassignDriver(user: RequestUser, assetId: string) {
    const asset = await this.callHr(() =>
      this.hr.unassignDriver(user.tenantId, assetId),
    );
    return this.rowFor(user.tenantId, asset);
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
    await this.assertNotOnTrip(user.tenantId, assetId);

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

  /** Builds a vehicle row, loading just this vehicle's trips (and details unless given). */
  private async rowFor(
    tenantId: string,
    asset: HrVehicleAsset,
    details?: FleetDetails | null,
  ) {
    const [resolvedDetails, trips] = await Promise.all([
      details === undefined ? this.findDetails(tenantId, asset.id) : details,
      this.trips.activeTrips(tenantId, { vehicleAssetIds: [asset.id] }),
    ]);
    return this.toRow(asset, resolvedDetails, trips);
  }

  /** A vehicle that is out on a trip can't be sent to maintenance or retired. */
  private async assertNotOnTrip(tenantId: string, assetId: string) {
    const trips = await this.trips.activeTrips(tenantId, {
      vehicleAssetIds: [assetId],
    });
    if (trips.some((trip) => trip.state === 'ON_ROUTE')) {
      throw new ConflictException(ON_TRIP_MESSAGE);
    }
  }

  /**
   * Fleet status is about the vehicle's availability, not its driver: retired and
   * maintenance come from HR, then a trip in progress means on route and a trip
   * still to come means booked. HR's own "assigned" (a driver is attached) does
   * not make a vehicle unavailable.
   */
  private deriveStatus(
    hrStatus: HrVehicleAsset['status'],
    trips: ScheduledTrip[],
  ): FleetStatus {
    if (hrStatus === 'RETIRED' || hrStatus === 'MAINTENANCE') return hrStatus;
    return strongestState(trips.map((trip) => trip.state)) ?? 'AVAILABLE';
  }

  private toRow(
    asset: HrVehicleAsset,
    details: FleetDetails | null | undefined,
    trips: ScheduledTrip[],
  ) {
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
      status: this.deriveStatus(asset.status, trips),
      // Raw HR state, so the UI knows whether maintenance can be cleared, etc.
      hrStatus: asset.status,
      trips: trips.slice(0, MAX_TRIPS_PER_ROW).map((trip) => ({
        requestId: trip.requestId,
        state: trip.state,
        overdue: trip.overdue,
        travelDate: trip.travelDate,
        departureTime: trip.departureTime,
        returnTime: trip.returnTime,
        destination: trip.destination,
        requesterName: trip.requesterName,
        driverName: trip.driver?.name ?? null,
        selfDriven: trip.selfDriven,
      })),
      tripCount: trips.length,
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
