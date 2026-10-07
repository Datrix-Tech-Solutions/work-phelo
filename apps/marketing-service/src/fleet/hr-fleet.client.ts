import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

export type HrAssetStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'MAINTENANCE'
  | 'RETIRED';

export interface HrVehicleAsset {
  id: string;
  assetNumber: string;
  name: string;
  status: HrAssetStatus;
  branchId: string | null;
  branchName?: string | null;
  assignedEmployeeId: string | null;
  /** The asset's recorded condition in HR. */
  condition?: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | null;
  assignedEmployeeName?: string;
  createdAt: string;
}

export interface HrFleetOptions {
  branches: { id: string; name: string }[];
  drivers: { id: string; name: string }[];
}

export interface CreateHrVehicleInput {
  name: string;
  branchId?: string;
  notes?: string;
}

const BASE = '/internal/fleet-assets';

/**
 * Typed wrapper over hr-service's internal vehicle-asset routes. The asset is
 * the source of truth for identity, branch, driver and status; this service
 * only layers fleet-specific details on top by assetId.
 */
@Injectable()
export class HrFleetClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'marketing-service',
    targetName: 'hr-service',
    baseUrl: process.env.HR_SERVICE_URL,
    timeoutMs: Number(process.env.HR_SERVICE_TIMEOUT_MS),
  });

  listVehicles(tenantId: string, filters: { ids?: string[] } = {}) {
    return this.http.get<HrVehicleAsset[]>(BASE, {
      query: { tenantId, ids: filters.ids?.join(',') },
    });
  }

  getOptions(tenantId: string) {
    return this.http.get<HrFleetOptions>(`${BASE}/options`, {
      query: { tenantId },
    });
  }

  getVehicle(tenantId: string, assetId: string) {
    return this.http.get<HrVehicleAsset>(`${BASE}/${assetId}`, {
      query: { tenantId },
    });
  }

  createVehicle(tenantId: string, input: CreateHrVehicleInput) {
    return this.http.post<HrVehicleAsset>(BASE, {
      body: { tenantId, ...input },
    });
  }

  updateVehicle(
    tenantId: string,
    assetId: string,
    input: {
      name?: string;
      branchId?: string | null;
      condition?: 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
    },
  ) {
    return this.http.patch<HrVehicleAsset>(`${BASE}/${assetId}`, {
      body: { tenantId, ...input },
    });
  }

  setStatus(
    tenantId: string,
    assetId: string,
    status: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED',
  ) {
    return this.http.post<HrVehicleAsset>(`${BASE}/${assetId}/status`, {
      body: { tenantId, status },
    });
  }

  assignDriver(tenantId: string, assetId: string, employeeId: string) {
    return this.http.post<HrVehicleAsset>(`${BASE}/${assetId}/assign`, {
      body: { tenantId, employeeId },
    });
  }

  unassignDriver(tenantId: string, assetId: string) {
    return this.http.post<HrVehicleAsset>(`${BASE}/${assetId}/unassign`, {
      body: { tenantId },
    });
  }
}
