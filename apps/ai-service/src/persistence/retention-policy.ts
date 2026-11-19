// Provisional internal policy; not authorization to activate production deletion.
export const AI_RETENTION_HOURS = 720;
export const AI_RETENTION_MS = AI_RETENTION_HOURS * 60 * 60 * 1000;

export function retentionDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + AI_RETENTION_MS);
}

export function appendReceiptLockScope(tenantId: string, ownerUserId: string, key: string) {
  return JSON.stringify(['ai.append.v1', tenantId, ownerUserId, key]);
}
