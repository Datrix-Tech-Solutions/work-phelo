// DEPARTMENT PAGE //

'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { useToast } from '@/hooks/useToast';

/* ── Types ── */
interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  isActive: boolean;
  _count: { employees: number };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  departmentId?: string;
  avatarUrl?: string;
}

interface DeptForm {
  name: string;
  description?: string;
  managerId?: string;
}

/* ── Status badge ── */
function DeptStatus({ count, isActive }: { count: number; isActive: boolean }) {
  if (!isActive) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
        Inactive
      </span>
    );
  }
  if (count === 0) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        Empty
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      Active
    </span>
  );
}

const PAGE_SIZE = 8;

/* ── Page ── */
export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  /* panel state */
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [membersTarget, setMembersTarget] = useState<Department | null>(null);

  /* member panel state */
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ── Data fetching ── */
  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/hr/departments').then((r) => r.data),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-all'],
    queryFn: () => api.get('/hr/employees').then((r) => r.data?.employees ?? r.data),
  });

  /* ── Resolve manager names ── */
  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  /* ── Table data ── */
  const filtered = useMemo(() => {
    if (!search) return departments;
    const q = search.toLowerCase();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Columns ── */
  const COLUMNS: Column<Department & { id: string }>[] = [
    {
      key: 'name',
      label: 'Department Name',
      width: '2fr',
    },
    {
      key: 'managerId',
      label: 'Department Head',
      width: '2fr',
      render: (row) => {
        const mgr = row.managerId ? employeeMap.get(row.managerId) : null;
        return mgr ? (
          <span className="text-sm text-gray-900">
            {mgr.firstName} {mgr.lastName}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      },
    },
    {
      key: '_count',
      label: 'Members',
      width: '1fr',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">{row._count.employees}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '1fr',
      render: (row) => <DeptStatus count={row._count.employees} isActive={row.isActive} />,
    },
  ];

  /* ── Create mutation ── */
  const createForm = useForm<DeptForm>();
  const { mutate: createDept, isPending: isCreating } = useMutation({
    mutationFn: (data: DeptForm) => api.post('/hr/departments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created');
      createForm.reset();
      setCreateOpen(false);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to create department'),
  });

  /* ── Edit mutation ── */
  const editForm = useForm<DeptForm>();
  const { mutate: editDept, isPending: isEditing } = useMutation({
    mutationFn: (data: DeptForm) => api.patch(`/hr/departments/${editTarget?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department updated');
      setEditTarget(null);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to update department'),
  });

  const openEdit = (dept: Department) => {
    editForm.reset({ name: dept.name, description: dept.description, managerId: dept.managerId });
    setEditTarget(dept);
  };

  /* ── Add members mutation ── */
  const { mutate: addMembers, isPending: isAddingMembers } = useMutation({
    mutationFn: async (departmentId: string) => {
      await Promise.all(
        [...selectedIds].map((empId) => api.patch(`/hr/employees/${empId}`, { departmentId })),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['employees-all'] });
      toast.success('Members added successfully');
      setMembersTarget(null);
      setSelectedIds(new Set());
      setMemberSearch('');
    },
    onError: () => toast.error('Failed to add some members'),
  });

  const openMembers = (dept: Department) => {
    setMembersTarget(dept);
    setSelectedIds(new Set());
    setMemberSearch('');
  };

  /* ── Filtered employees for member panel ── */
  const filteredEmployees = useMemo(() => {
    const q = memberSearch.toLowerCase();
    return employees.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return !q || name.includes(q) || e.jobTitle?.toLowerCase().includes(q);
    });
  }, [employees, memberSearch]);

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-8 flex flex-col gap-6 flex-1 min-h-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Departments</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your company's departments and team members
        </p>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <DataTable
          columns={COLUMNS}
          data={pageData}
          isLoading={isLoading}
          searchPlaceholder="Search departments..."
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          actionButton={{ label: 'New Department', onClick: () => setCreateOpen(true) }}
          rowActions={(row) => [
            { label: 'Edit Department', onClick: () => openEdit(row) },
            { label: 'Add Members', onClick: () => openMembers(row) },
          ]}
          emptyMessage="No departments found"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      {/* ── Create Department panel ── */}
      <SidePanel
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          createForm.reset();
        }}
        title="New Department"
        description="Add a new department to your organisation."
        width="w-[440px]"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                createForm.reset();
              }}
            >
              Cancel
            </Button>
            <Button
              isLoading={isCreating}
              loadingText="Creating…"
              onClick={createForm.handleSubmit((data) => createDept(data))}
            >
              Create
            </Button>
          </div>
        }
      >
        <FormField
          label="Department Name"
          registration={createForm.register('name', { required: 'Name is required' })}
          error={createForm.formState.errors.name}
          placeholder="eg. Human Resources"
        />
        <FormField
          label="Description"
          registration={createForm.register('description')}
          placeholder="Brief description of the department"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Department Head</label>
          <select
            {...createForm.register('managerId')}
            className="w-full border border-gray-300 rounded-input px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
          >
            <option value="">No head assigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName} — {e.jobTitle}
              </option>
            ))}
          </select>
        </div>
      </SidePanel>

      {/* ── Edit Department panel ── */}
      <SidePanel
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Department"
        description={`Editing "${editTarget?.name}"`}
        width="w-[440px]"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              isLoading={isEditing}
              loadingText="Saving…"
              onClick={editForm.handleSubmit((data) => editDept(data))}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <FormField
          label="Department Name"
          registration={editForm.register('name', { required: 'Name is required' })}
          error={editForm.formState.errors.name}
          placeholder="eg. Human Resources"
        />
        <FormField
          label="Description"
          registration={editForm.register('description')}
          placeholder="Brief description of the department"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Department Head</label>
          <select
            {...editForm.register('managerId')}
            className="w-full border border-gray-300 rounded-input px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
          >
            <option value="">No head assigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName} — {e.jobTitle}
              </option>
            ))}
          </select>
        </div>
      </SidePanel>

      {/* ── Add Members panel ── */}
      <SidePanel
        isOpen={!!membersTarget}
        onClose={() => {
          setMembersTarget(null);
          setSelectedIds(new Set());
          setMemberSearch('');
        }}
        title="Add Members"
        description={`Select employees to add to "${membersTarget?.name}"`}
        width="w-[460px]"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">
              {selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setMembersTarget(null);
                  setSelectedIds(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                isLoading={isAddingMembers}
                loadingText="Adding…"
                disabled={selectedIds.size === 0}
                onClick={() => membersTarget && addMembers(membersTarget.id)}
              >
                Add Members
              </Button>
            </div>
          </div>
        }
      >
        {/* Search for employees */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
          />
        </div>

        {/* Employee list */}
        <div className="flex flex-col divide-y divide-gray-100 -mx-6 px-6">
          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No employees found</p>
          ) : (
            filteredEmployees.map((emp) => {
              const checked = selectedIds.has(emp.id);
              const alreadyInDept = emp.departmentId === membersTarget?.id;
              const initials = `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase();

              return (
                <label
                  key={emp.id}
                  className={`flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 -mx-6 px-6 transition-colors ${alreadyInDept ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked || alreadyInDept}
                    disabled={alreadyInDept}
                    onChange={() => !alreadyInDept && toggleEmployee(emp.id)}
                    className="w-4 h-4 rounded accent-[#0D2244] shrink-0"
                  />
                  <div className="w-8 h-8 rounded-full bg-[#0D2244] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{emp.jobTitle}</p>
                  </div>
                  {alreadyInDept && (
                    <span className="text-xs text-gray-400 shrink-0">Already in dept</span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </SidePanel>
    </div>
  );
}
