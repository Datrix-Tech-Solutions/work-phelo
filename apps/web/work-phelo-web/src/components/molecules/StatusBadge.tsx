import { Badge } from '@/components/atoms/Badge';

interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  PENDING: { label: 'Pending', variant: 'warning' },
  PENDING_VERIFICATION: { label: 'Pending', variant: 'warning' },
  SUSPENDED: { label: 'Suspended', variant: 'danger' },
  INACTIVE: { label: 'Inactive', variant: 'danger' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  ON_LEAVE: { label: 'On Leave', variant: 'info' },
  PROBATION: { label: 'Probation', variant: 'warning' },
  TERMINATED: { label: 'Terminated', variant: 'danger' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge label={config.label} variant={config.variant} />;
}
