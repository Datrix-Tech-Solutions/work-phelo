import { AsyncLocalStorage } from 'node:async_hooks';

export interface ExecutionLease {
  tenantId: string;
  ownerUserId: string;
  leaseId: string;
  slots: { ownerUserId: string; slot: number; generation: bigint }[];
}
export const executionContext = new AsyncLocalStorage<ExecutionLease>();
