import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import type { Department } from '@/types/hr';

interface DepartmentsTableProps {
  departments: Department[];
  isLoading: boolean;
  isEmployee: boolean;
  onCreate: () => void;
  onEdit: (dept: Department) => void;
  onAddMembers: (dept: Department) => void;
}

export function DepartmentsTable({
  departments,
  isLoading,
  isEmployee,
  onCreate,
  onEdit,
  onAddMembers,
}: DepartmentsTableProps) {
  const COLUMNS: Column<Department>[] = [
    {
      key: 'name',
      label: 'Department Name',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'manager',
      label: 'Department Head',
      render: () => <span className="text-sm text-gray-500">—</span>,
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
      render: (row) => {
        const count = row._count?.employees ?? 0;
        if (!row.isActive) return <Badge variant="neutral" label="Inactive" />;
        if (count === 0) return <Badge variant="warning" label="Empty" />;
        return <Badge variant="success" label="Active" />;
      },
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
