import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import type { Department, EmployeeOption } from '@/types/hr';

interface DepartmentsTableProps {
  departments: Department[];
  employees: EmployeeOption[];
  isLoading: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: () => void;
  onEdit: (dept: Department) => void;
  onAddMembers: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  onToggleActive: (dept: Department) => void;
}

export function DepartmentsTable({
  departments,
  employees,
  isLoading,
  canCreate,
  canUpdate,
  canDelete,
  onCreate,
  onEdit,
  onAddMembers,
  onDelete,
  onToggleActive,
}: DepartmentsTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`])),
    [employees],
  );

  const filtered = useMemo(() => {
    if (!search) return departments;
    const q = search.toLowerCase();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const COLUMNS: Column<Department>[] = [
    {
      key: 'name',
      label: 'Department Name',
      width: '2fr',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'manager',
      label: 'Department Head',
      width: '2fr',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {row.managerId ? (employeeMap.get(row.managerId) ?? '—') : '—'}
        </span>
      ),
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
    <div className="flex flex-col">
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search departments..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={canCreate ? { label: 'New Department', onClick: onCreate } : undefined}
        rowActions={
          canUpdate || canDelete
            ? (row) => [
                ...(canUpdate
                  ? [
                      { label: 'Edit Department', onClick: () => onEdit(row) },
                      { label: 'Add Members', onClick: () => onAddMembers(row) },
                      {
                        label: row.isActive ? 'Deactivate' : 'Activate',
                        onClick: () => onToggleActive(row),
                      },
                    ]
                  : []),
                ...(canDelete
                  ? [{ label: 'Delete', onClick: () => onDelete(row), danger: true }]
                  : []),
              ]
            : undefined
        }
        emptyMessage="No departments found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />
    </div>
  );
}
