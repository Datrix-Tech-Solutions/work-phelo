import { Injectable } from '@nestjs/common';
import { PlacementFinancialLockSource } from './dto/placement-lock-status.dto';

export type PlacementFinancialActivity = {
  source: Exclude<PlacementFinancialLockSource, 'NONE' | 'STATUS_TERMINAL'>;
  lockedAt?: Date | null;
};

@Injectable()
export class PlacementFinancialActivityReader {
  findLockingActivity(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementFinancialActivity | null> {
    void tenantId;
    void placementId;
    // Future payment/claim settlement tables will be checked here.
    return Promise.resolve(null);
  }
}
