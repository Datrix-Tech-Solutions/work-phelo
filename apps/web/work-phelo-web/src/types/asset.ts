import { AssetType } from '@/lib/assetIcons';

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface Asset {
  id: string;
  assetNumber?: string;
  name: string;
  type: AssetType;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  condition?: AssetCondition;
  notes?: string;
  status: AssetStatus;
  assignedTo?: string;
  assignedEmployeeName?: string;
  assignedAt?: string;
}

// Subset used when rendering an employee's assigned assets (assignedAt is always present)
export interface EmployeeAsset {
  id: string;
  name: string;
  type: AssetType;
  assignedAt: string;
}
