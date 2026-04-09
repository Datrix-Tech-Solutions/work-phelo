import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';

const APPLICABILITY_LABELS: Record<string, string> = {
  All: 'All Employees',
  FullTime: 'Full-time',
  PartTime: 'Part-time',
  Contract: 'Contract',
};

interface DepartmentsTableProps {
  departments: any[];
  isLoading: boolean;
  isEmployee: boolean;
  onCreate: () => void;
  onEdit: (dept: any) => void;
  onAddMembers: (dept: any) => void;
}

export function DepartmentsTable({
  departments,
  isLoading,
  isEmployee,
  onCreate,
  onEdit,
  onAddMembers,
}: DepartmentsTableProps) {
  const COLUMNS: Column<any>[] = [
    {
      key: 'name',
      label: 'Department Name',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'manager',
      label: 'Department Head',
      render: (row) => {
        // You can enhance this with real manager name if available
        return <span className="text-sm text-gray-500">—</span>;
      },
    },
    {
      key: 'memberCount',
      label: 'Members',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">{row._count?.employees ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge
          variant={row.isActive ? 'success' : 'neutral'}
          label={row.isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={COLUMNS}
      data={departments}
      isLoading={isLoading}
      searchPlaceholder="Search departments..."
      onSearch={() => {}}
      actionButton={
        !isEmployee
          ? {
              label: 'New Department',
              onClick: onCreate,
            }
          : undefined
      }
      rowActions={
        isEmployee
          ? undefined
          : (row) => [
              { label: 'Edit Department', onClick: () => onEdit(row) },
              { label: 'Add Members', onClick: () => onAddMembers(row) },
            ]
      }
      emptyMessage="No departments found"
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
    />
  );
}
