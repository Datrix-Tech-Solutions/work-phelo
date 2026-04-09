// DEPARTMENT PAGE //

'use client';

import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Department, Employee } from '@/types/hr';
import { useDepartments, useCreateDepartment, useUpdateDepartment } from '@/hooks/useDepartments';
import { useEmployees, useUpdateEmployee } from '@/hooks/useEmployees';
import { SuccessModal } from '@/components/organisms/SuccessModal';
import { useAuthStore } from '@/store/auth.store';
import { DeptStatus } from '@/components/molecules/departments/DepartmentStatus';
import { MemberRow } from '@/components/molecules/departments/MemberRow';
import {
  DepartmentFormFields,
  DeptForm,
} from '@/components/molecules/departments/DepartmentFormFields';

const PAGE_SIZE = 8;

export default function DepartmentsPage() {
  const toast = useToast();

  const user = useAuthStore((s) => s.user);
  const isEmployee = user?.role === 'EMPLOYEE' && !user?.isManager;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [membersTarget, setMembersTarget] = useState<Department | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  /* ── Data ── */
  const { data: departments = [], isLoading } = useDepartments();
  const { data: empResult } = useEmployees({ limit: 500 });
  const employees = empResult?.data ?? [];

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  /* ── Table ── */
  const filtered = useMemo(() => {
    if (!search) return departments;
    const q = search.toLowerCase();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const COLUMNS: Column<Department & { id: string }>[] = [
    { key: 'name', label: 'Department Name', width: '2fr' },
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
        <span className="text-sm font-medium text-gray-700">{row._count?.employees ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '1fr',
      render: (row) => <DeptStatus count={row._count?.employees ?? 0} isActive={row.isActive} />,
    },
  ];

  /* ── Create ── */
  const createForm = useForm<DeptForm>();
  const { mutate: createDeptMutate, isPending: isCreating } = useCreateDepartment();

  const createDept = (data: DeptForm) =>
    createDeptMutate(data, {
      onSuccess: () => {
        createForm.reset();
        setCreateOpen(false);
        setSuccessName(data.name);
      },
      onError: (err: unknown) => toast.error(extractError(err, 'Failed to create department')),
    });

  /* ── Edit ── */
  const editForm = useForm<DeptForm>();
  const { mutate: updateDeptMutate, isPending: isEditing } = useUpdateDepartment();

  const editDept = (data: DeptForm) => {
    if (!editTarget) return;
    updateDeptMutate(
      { id: editTarget.id, ...data },
      {
        onSuccess: () => {
          toast.success('Department updated');
          setEditTarget(null);
        },
        onError: (err: unknown) => toast.error(extractError(err, 'Failed to update department')),
      },
    );
  };

  const openEdit = (dept: (typeof departments)[number]) => {
    editForm.reset({ name: dept.name, description: dept.description, managerId: dept.managerId });
    setEditTarget(dept);
  };

  /* ── Add members ── */
  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployee();
  const { mutate: addMembers, isPending: isAddingMembers } = useMutation({
    mutationFn: async (departmentId: string) => {
      await Promise.all(
        [...selectedIds].map((empId) => updateEmployeeAsync({ id: empId, departmentId })),
      );
    },
    onSuccess: () => {
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
          Manage your company&apos;s departments and team members
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
          {...(!isEmployee && {
            actionButton: { label: 'New Department', onClick: () => setCreateOpen(true) },
          })}
          rowActions={
            isEmployee
              ? undefined
              : (row) => [
                  { label: 'Edit Department', onClick: () => openEdit(row) },
                  { label: 'Add Members', onClick: () => openMembers(row) },
                ]
          }
          emptyMessage="No departments found"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      {/* ── Create Department panel ── */}
      {!isEmployee && (
        <>
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
                  onClick={createForm.handleSubmit(createDept)}
                >
                  Create
                </Button>
              </div>
            }
          >
            <DepartmentFormFields form={createForm} employees={employees} />
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
                  onClick={editForm.handleSubmit(editDept)}
                >
                  Save Changes
                </Button>
              </div>
            }
          >
            <DepartmentFormFields form={editForm} employees={employees} />
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

            <div className="flex flex-col divide-y divide-gray-100 -mx-6 px-6">
              {filteredEmployees.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No employees found</p>
              ) : (
                filteredEmployees.map((emp) => (
                  <MemberRow
                    key={emp.id}
                    employee={emp}
                    checked={selectedIds.has(emp.id)}
                    alreadyInDept={emp.departmentId === membersTarget?.id}
                    onToggle={toggleEmployee}
                  />
                ))
              )}
            </div>
          </SidePanel>
        </>
      )}

      <SuccessModal
        isOpen={!!successName}
        onClose={() => setSuccessName(null)}
        title="Department Created!"
        message={`"${successName}" has been added to your organisation.`}
      />
    </div>
  );
}
