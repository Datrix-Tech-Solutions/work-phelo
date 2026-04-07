// EMPLOYEE DETAILS PAGE //

'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/atoms/Button';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

import { AssetType } from '@/lib/assetIcons';
import { ChevronRight, UserRoundMinus, UserRoundPen } from 'lucide-react';
import { AssetCard } from '@/components/molecules/empAssetCard';
import { SectionCard } from '@/components/molecules/sectionCard';
import { OffboardEmployeePanel } from '@/components/organisms/employee/OffboardEmployeePanel';
import { EditEmployeePanel } from '@/components/organisms/employee/EditEmployeePanel';
import { AssignAssetPanel } from '@/components/organisms/employee/AssignAssetEmployeePanel';
import { DetailField } from '@/components/molecules/DetailField';
import {
  useDepartments,
  useEmployee,
  useEmployees,
  useOffboardEmployee,
  useResendEmployeeInvite,
  useUpdateEmployee,
} from '@/hooks';

/* ── Types ── */
interface Asset {
  id: string;
  name: string;
  type: AssetType;
  assignedAt: string;
}

/* ── Icons ── */
function ChevronIcon() {
  return <ChevronRight className="w-5 h-5" />;
}

function OffboardIcon() {
  return <UserRoundMinus className="w-5 h-5" />;
}

function EditIcon() {
  return <UserRoundPen className="w-5 h-5" />;
}

/* ── Helpers ── */
function formatDate(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatType(t?: string) {
  if (!t) return undefined;
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Page ── */
export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const toast = useToast();

  const [offboardOpen, setOffboardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignAssetOpen, setAssignAssetOpen] = useState(false);

  /* ── Queries ── */
  const { data: employee, isLoading } = useEmployee(id);
  const { data: departments = [] } = useDepartments();
  const { data: allHrResult } = useEmployees();
  const allHrEmployees = allHrResult?.data ?? [];

  /* ── Mutations ── */
  const { mutate: processOffboard, isPending: isOffboarding } = useOffboardEmployee();

  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();

  /* ── Resend invite ── */
  const { mutate: resendInvite, isPending: isResending } = useResendEmployeeInvite();

  /* ── Loading / not found ── */
  if (isLoading) {
    return (
      <div className="p-8 flex flex-col gap-6">
        <div className="h-5 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="flex gap-6">
          <div className="w-72 h-64 bg-gray-100 rounded-card animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-40 bg-gray-100 rounded-card animate-pulse" />
            <div className="h-40 bg-gray-100 rounded-card animate-pulse" />
            <div className="h-40 bg-gray-100 rounded-card animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 flex items-center justify-center flex-1">
        <p className="text-sm text-gray-400">Employee not found.</p>
      </div>
    );
  }

  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();

  const isPendingInvite = !employee.userId;
  const isOffboarded = employee.employmentStatus === 'OFFBOARDED';

  /* resolve manager name */
  const manager = employee?.managerId
    ? allHrEmployees.find((e) => e.id === employee.managerId)
    : null;
  const managerName = manager ? `${manager.firstName} ${manager.lastName}` : undefined;

  /* ── Available assets for assignment (dummy) ── */
  const AVAILABLE_ASSETS = [
    {
      id: 'a1',
      name: 'MacBook Pro 14"',
      type: 'LAPTOP' as const,
      condition: 'GOOD' as const,
      assetNumber: 'LAP-0012',
    },
    {
      id: 'a2',
      name: 'iPhone 15 Pro',
      type: 'PHONE' as const,
      condition: 'NEW' as const,
      assetNumber: 'PHN-0002',
    },
    {
      id: 'a3',
      name: 'Dell 27" Monitor',
      type: 'MONITOR' as const,
      condition: 'GOOD' as const,
      assetNumber: 'MON-0008',
    },
    {
      id: 'a4',
      name: 'HP LaserJet Pro',
      type: 'PRINTER' as const,
      condition: 'FAIR' as const,
      assetNumber: 'PRT-0004',
    },
    {
      id: 'a5',
      name: 'USB-C Docking Station',
      type: 'OTHER' as const,
      condition: 'NEW' as const,
      assetNumber: 'OTH-0009',
    },
    {
      id: 'a6',
      name: 'Toyota Corolla 2023',
      type: 'VEHICLE' as const,
      condition: 'GOOD' as const,
      assetNumber: 'VEH-0011',
    },
    {
      id: 'a7',
      name: 'Reception Desk',
      type: 'FURNITURE' as const,
      condition: 'GOOD' as const,
      assetNumber: 'FUR-0006',
    },
    {
      id: 'a8',
      name: 'Microsoft Office 365',
      type: 'SOFTWARE_LICENSE' as const,
      condition: 'NEW' as const,
      assetNumber: 'SFT-0015',
    },
  ];

  /* Assets */
  const assets: Asset[] = [
    { id: '1', name: 'MacBook Pro 14"', type: 'LAPTOP', assignedAt: '2024-02-01' },
    { id: '2', name: 'iPhone 15 Pro', type: 'PHONE', assignedAt: '2024-02-01' },
    { id: '3', name: 'Dell 27" Monitor', type: 'MONITOR', assignedAt: '2024-03-10' },
    { id: '4', name: 'iPad Pro 11"', type: 'TABLET', assignedAt: '2024-05-20' },
    { id: '5', name: 'Sony WH-1000XM5', type: 'OTHER', assignedAt: '2024-06-15' },
  ];

  return (
    <div className="p-8 flex flex-col gap-6 overflow-y-auto overflow-x-hidden">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/hr/employees`}
            className="hover:text-gray-700 transition-colors"
          >
            Employees
          </Link>
          <ChevronIcon />
          <span className="text-gray-700 font-medium">{name}</span>
        </nav>

        <div className="flex items-center gap-3">
          {isPendingInvite ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                employee.userId &&
                resendInvite(employee.userId, {
                  onSuccess: () => toast.success('Invite resent successfully'),
                  onError: (err) => toast.error(extractError(err, 'Failed to resend invite')),
                })
              }
              isLoading={isResending}
              loadingText="Sending…"
            >
              Resend Invite
            </Button>
          ) : !isOffboarded ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setAssignAssetOpen(true)}>
                Assign Asset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffboardOpen(true)}
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                Off-Board
                <OffboardIcon />
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
            Edit
            <EditIcon />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-6 items-start">
        {/* ── Left profile card ── */}
        <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-card p-6 flex flex-col items-start gap-4">
          {/* Avatar */}
          {employee.avatarUrl ? (
            <Image
              src={employee.avatarUrl}
              alt={initials}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#0D2244] flex items-center justify-center text-white text-2xl font-bold">
              {initials}
            </div>
          )}
          <div className="text-left">
            <p className="text-base font-bold text-gray-900">{name}</p>
            {employee?.jobTitle && (
              <p className="text-sm text-gray-400 mt-0.5">{employee.jobTitle}</p>
            )}
          </div>

          <div className="w-full border-t border-gray-100" />

          {/* Contact details */}
          <div className="w-full flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400">Email Address</span>
              <span className="text-sm font-medium text-gray-900 break-all">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Phone Number</span>
                <span className="text-sm font-medium text-gray-900">{employee.phone}</span>
              </div>
            )}
            {employee?.employeeNumber && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Employee No.</span>
                <span className="text-sm font-medium text-gray-900">{employee.employeeNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right sections ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Employment Details */}
          <SectionCard title="Employment Details">
            <div className="grid grid-cols-4 gap-x-6 gap-y-5">
              <DetailField label="Department" value={employee?.department?.name} />
              <DetailField label="Job Title" value={employee?.jobTitle} />
              <DetailField label="Reporting Manager" value={managerName} />
              <DetailField label="Date of Hire" value={formatDate(employee?.hireDate)} />
              <DetailField label="Employment Type" value={formatType(employee?.employmentType)} />
              {employee?.dateOfBirth && (
                <DetailField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
              )}
              {employee?.nationality && (
                <DetailField label="Nationality" value={employee.nationality} />
              )}
              {employee?.address && (
                <DetailField
                  label="Address"
                  value={[employee.address, employee.city, employee.region]
                    .filter(Boolean)
                    .join(', ')}
                />
              )}
            </div>
          </SectionCard>

          {/* Account Details */}
          <SectionCard title="Account Details">
            <div className="grid grid-cols-4 gap-x-6 gap-y-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Employment Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={employee.employmentStatus} />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Invite Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={isPendingInvite ? 'PENDING' : 'ACTIVE'} />
                </div>
              </div>
              {employee?.bankName && <DetailField label="Bank" value={employee.bankName} />}
              {employee?.bankAccountNumber && (
                <DetailField label="Account Number" value={employee.bankAccountNumber} />
              )}
              {employee?.ssnit && <DetailField label="SSNIT" value={employee.ssnit} />}
              {employee?.tinNumber && <DetailField label="TIN" value={employee.tinNumber} />}
              {employee?.emergencyName && (
                <DetailField
                  label="Emergency Contact"
                  value={`${employee.emergencyName}${employee.emergencyRelation ? ` (${employee.emergencyRelation})` : ''}`}
                />
              )}
              {employee?.emergencyPhone && (
                <DetailField label="Emergency Phone" value={employee.emergencyPhone} />
              )}
            </div>
          </SectionCard>

          {/* Assets */}
          {assets.length === 0 ? (
            <SectionCard title="Assets">
              <p className="text-sm text-gray-400 py-2">No assets assigned to this employee.</p>
            </SectionCard>
          ) : (
            <SectionCard title="Assets" scrollX>
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </SectionCard>
          )}
        </div>
      </div>
      {/* ── Offboard Side Panel ── */}
      <OffboardEmployeePanel
        isOpen={offboardOpen}
        onClose={() => setOffboardOpen(false)}
        employee={employee}
        allHrEmployees={allHrEmployees}
        onOffboard={(formData) =>
          processOffboard(
            { id: employee.id, reason: formData.reason },
            {
              onSuccess: () => {
                toast.success('Employee offboarded successfully');
                setOffboardOpen(false);
              },
              onError: (err) => toast.error(extractError(err, 'Failed to offboard employee')),
            },
          )
        }
        isOffboarding={isOffboarding}
      />

      {/* ── Edit Side Panel ── */}
      <EditEmployeePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        employee={employee}
        departments={departments}
        name={name}
        onSave={(formData) =>
          updateEmployee(
            { id: employee.id, ...formData },
            {
              onSuccess: () => {
                toast.success('Employee updated successfully');
                setEditOpen(false);
              },
              onError: (err) => toast.error(extractError(err, 'Failed to update employee')),
            },
          )
        }
        isUpdating={isUpdating}
      />

      {/* ── Assign Asset Side Panel ── */}
      <AssignAssetPanel
        isOpen={assignAssetOpen}
        onClose={() => setAssignAssetOpen(false)}
        employeeName={name}
        availableAssets={AVAILABLE_ASSETS}
        onAssign={(assetId) => {
          console.log('Assigning asset:', assetId, 'to employee:', employee?.id);
        }}
      />
    </div>
  );
}
