import { Badge } from '@/components/atoms/Badge';

export interface ReinsurerPolicy {
  id: string;
  kind: 'Treaty' | 'Facultative';
  name: string;
  share: number;
  status: string;
  periodFrom: string;
  periodTo: string;
}

interface ReinsurerPoliciesTableProps {
  data: ReinsurerPolicy[];
  isLoading?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'Active':
    case 'Closed':
      return 'success';
    case 'Pending':
    case 'Open':
      return 'warning';
    case 'Expired':
    case 'Cancelled':
    case 'Rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

function kindBadge(kind: ReinsurerPolicy['kind']) {
  return (
    <span
      className={
        kind === 'Treaty'
          ? 'inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-xs font-medium text-blue-700'
          : 'inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-xs font-medium text-purple-700'
      }
    >
      {kind}
    </span>
  );
}

export function ReinsurerPoliciesTable({ data, isLoading }: ReinsurerPoliciesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-400">Loading…</div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
        No policies found for this reinsurer.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Name / Policy No.
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Share (%)
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Period
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">{kindBadge(row.kind)}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
              <td className="px-4 py-3 text-gray-700">{row.share}%</td>
              <td className="px-4 py-3">
                <Badge label={row.status} variant={statusVariant(row.status)} />
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {formatDate(row.periodFrom)} – {formatDate(row.periodTo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
