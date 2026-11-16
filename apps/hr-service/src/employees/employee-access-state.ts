export function deriveEmployeeAccessState(
  userId: string | null,
  operation: {
    status: string;
    targetUserId: string | null;
    action: string;
  } | null,
  accountStatus: string | null,
): string {
  if (
    operation &&
    ((operation.status === 'COMPLETED' && userId !== operation.targetUserId) ||
      (userId && operation.targetUserId && userId !== operation.targetUserId))
  )
    return 'INCONSISTENT';
  if (userId)
    return !accountStatus || accountStatus === 'MISSING'
      ? 'INCONSISTENT'
      : accountStatus;
  if (!operation) return 'NONE';
  if (operation.action !== 'GRANT') return 'INCONSISTENT';
  return ['FAILED', 'PAUSED'].includes(operation.status)
    ? 'PROVISIONING_FAILED'
    : 'PROVISIONING';
}
