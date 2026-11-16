import { EmployeeAccessAccount } from '@work-phelo/types';

export function classifyEmployeeAccount(
  user: {
    status: string;
    hasInvite: boolean;
    inviteExpiresAt: Date | null;
    suspended: boolean;
  } | null,
  grant: string | null,
  resend: string | null,
  now: Date,
): EmployeeAccessAccount['status'] {
  if (!user) return 'MISSING';
  if (user.status === 'PENDING_VERIFICATION') {
    if (!user.hasInvite || !user.inviteExpiresAt || user.inviteExpiresAt <= now)
      return 'INVITE_EXPIRED';
    if (resend)
      return resend === 'COMPLETED'
        ? 'INVITED'
        : resend === 'READY'
          ? 'PROVISIONING'
          : 'PROVISIONING_FAILED';
    if (grant && grant !== 'PROVIDER_ACCEPTED')
      return ['FAILED', 'PAUSED', 'EXPIRED'].includes(grant)
        ? 'PROVISIONING_FAILED'
        : 'PROVISIONING';
    return 'INVITED';
  }
  if (user.status === 'SUSPENDED')
    return user.suspended ? 'SUSPENDED' : 'INCONSISTENT';
  if (user.status === 'ACTIVE')
    return user.suspended ? 'INCONSISTENT' : 'ACTIVE';
  return 'INACTIVE';
}
