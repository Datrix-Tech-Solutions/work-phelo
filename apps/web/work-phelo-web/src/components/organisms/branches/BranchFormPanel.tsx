'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useCreateBranch, useUpdateBranch, useBranches } from '@/hooks';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import type { Branch, Employee } from '@/types/hr';
import { PhoneInput } from '@/components/atoms/PhoneInput';

interface BranchForm {
  name: string;
  code: string;
  address: string;
  city: string;
  region: string;
  country: string;
  phone: string;
  email: string;
  managerId: string;
  isHeadOffice: boolean;
}

interface BranchFormPanelProps {
  isOpen: boolean;
  onClose: () => void;

  /** Pass a Branch to edit, omit for create mode */
  branch?: Branch | null;
  employees: Employee[];
}

function BranchFormInner({ onClose, branch, employees }: Omit<BranchFormPanelProps, 'isOpen'>) {
  const isEditMode = !!branch;

  const toast = useToast();
  const [successBranch, setSuccessBranch] = useState<string | null>(null);
  const [headOfficeConfirmOpen, setHeadOfficeConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<
    Parameters<ReturnType<typeof useCreateBranch>['mutate']>[0] | null
  >(null);

  const { data: branches = [] } = useBranches();

  const form = useForm<BranchForm>({
    defaultValues: branch
      ? {
          name: branch.name,
          code: branch.code ?? '',
          address: branch.address ?? '',
          city: branch.city ?? '',
          region: branch.region ?? '',
          country: branch.country ?? '',
          phone: branch.phone ?? '',
          email: branch.email ?? '',
          managerId: branch.managerId ?? '',
          isHeadOffice: branch.isHeadOffice,
        }
      : {
          name: '',
          code: '',
          address: '',
          city: '',
          region: '',
          country: '',
          phone: '',
          email: '',
          managerId: '',
          isHeadOffice: false,
        },
  });

  const { mutate: createBranch, isPending: isCreating } = useCreateBranch();
  const { mutate: updateBranch, isPending: isUpdating } = useUpdateBranch();
  const isPending = isCreating || isUpdating;
  const existingHeadOffice = branches.find(
    (existingBranch) => existingBranch.isHeadOffice && existingBranch.id !== branch?.id,
  );
  const headOfficeLocked = isEditMode && !!existingHeadOffice && !branch?.isHeadOffice;

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      ...data,
      managerId: data.managerId || undefined,
      code: data.code || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      region: data.region || undefined,
      country: data.country || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
    };

    if (isEditMode) {
      updateBranch(
        { id: branch.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Branch updated');
            onClose();
          },
          onError: (err) => toast.error(extractError(err, 'Failed to update branch')),
        },
      );
    } else {
      const existingHeadOffice = branches?.find((b) => b.isHeadOffice);
      if (data.isHeadOffice && existingHeadOffice) {
        setPendingPayload(payload);
        setHeadOfficeConfirmOpen(true);
        return;
      }
      createBranch(payload, {
        onSuccess: () => {
          setSuccessBranch(data.name);
          onClose();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to create branch')),
      });
    }
  });

  const handleConfirmChangeHeadOffice = () => {
    if (!pendingPayload) return;
    const existingHeadOffice = branches?.find((b) => b.isHeadOffice);
    const doCreate = () => {
      createBranch(pendingPayload, {
        onSuccess: () => {
          setHeadOfficeConfirmOpen(false);
          setPendingPayload(null);
          setSuccessBranch((pendingPayload as { name: string }).name);
          onClose();
        },
        onError: (err) => {
          toast.error(extractError(err, 'Failed to create branch'));
          setHeadOfficeConfirmOpen(false);
          setPendingPayload(null);
        },
      });
    };

    if (existingHeadOffice) {
      updateBranch(
        { id: existingHeadOffice.id, isHeadOffice: false },
        {
          onSuccess: doCreate,
          onError: (err) => toast.error(extractError(err, 'Failed to update existing head office')),
        },
      );
    } else {
      doCreate();
    }
  };

  const managerOptions = [
    { value: '', label: 'No manager assigned' },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName}`,
      sublabel: e.jobTitle,
    })),
  ];

  const existingHeadOfficeName = branches?.find((b) => b.isHeadOffice)?.name;

  return (
    <>
      <Modal
        isOpen={headOfficeConfirmOpen}
        onClose={() => setHeadOfficeConfirmOpen(false)}
        title="Head Office Already Assigned"
        description={`"${existingHeadOfficeName}" is currently your head office. Would you like to reassign it to this new branch, or keep the current one?`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setHeadOfficeConfirmOpen(false)}
              disabled={isCreating}
            >
              Keep Current
            </Button>
            <Button
              isLoading={isCreating}
              loadingText="Creating…"
              onClick={handleConfirmChangeHeadOffice}
            >
              Change Head Office
            </Button>
          </>
        }
      />
      <SuccessModal
        isOpen={!!successBranch}
        onClose={() => setSuccessBranch(null)}
        title="Branch Created!"
        message={`"${successBranch}" has been added to your organisation.`}
      />
      <SidePanel
        isOpen
        onClose={onClose}
        title={isEditMode ? 'Edit Branch' : 'New Branch'}
        description={
          isEditMode
            ? `Editing "${branch.name}"`
            : 'Add a new office location to your organisation.'
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              isLoading={isPending}
              loadingText={isEditMode ? 'Saving…' : 'Creating…'}
              onClick={onSubmit}
            >
              {isEditMode ? 'Save Changes' : 'Create Branch'}
            </Button>
          </div>
        }
      >
        <FormField
          label="Branch Name"
          registration={form.register('name', { required: 'Name is required' })}
          error={form.formState.errors.name}
          placeholder="e.g. Accra Central"
        />
        <FormField
          label="Branch Code"
          registration={form.register('code')}
          placeholder="e.g. BR-001"
        />

        {/* Location */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</p>
          <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-input border border-gray-100">
            <FormField
              label="Street Address"
              registration={form.register('address')}
              placeholder="e.g. 12 Independence Ave"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="City"
                registration={form.register('city')}
                placeholder="e.g. Accra"
              />
              <FormField
                label="Region / State"
                registration={form.register('region')}
                placeholder="e.g. Greater Accra"
              />
            </div>
            <FormField
              label="Country"
              registration={form.register('country')}
              placeholder="e.g. Ghana"
            />
          </div>
        </div>

        {/* Contact */}
        <Controller
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <PhoneInput
              label="Phone"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              placeholder="30 000 0000"
            />
          )}
        />
        <FormField
          label="Email"
          registration={form.register('email', {
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email address' },
          })}
          error={form.formState.errors.email}
          placeholder="e.g. accra@company.com"
          type="email"
        />

        {/* Manager — controlled via Controller since SearchSelect isn't a native input */}
        <Controller
          control={form.control}
          name="managerId"
          render={({ field }) => (
            <SearchSelect
              label="Branch Manager"
              placeholder="Select manager"
              value={field.value}
              onChange={field.onChange}
              options={managerOptions}
            />
          )}
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isHeadOffice"
            {...form.register('isHeadOffice')}
            disabled={headOfficeLocked}
            className="w-4 h-4 rounded accent-brand"
          />
          <label
            htmlFor="isHeadOffice"
            className={`text-sm font-medium ${headOfficeLocked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'}`}
          >
            This is the Head Office
          </label>
        </div>
        {headOfficeLocked && (
          <p className="text-sm text-amber-600">
            {existingHeadOffice.name} is already marked as the head office. Remove that setting
            there before assigning another one.
          </p>
        )}
      </SidePanel>
    </>
  );
}

export function BranchFormPanel({ isOpen, onClose, branch, employees }: BranchFormPanelProps) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return (
    <BranchFormInner
      key={branch?.id ?? 'new'}
      onClose={onClose}
      branch={branch}
      employees={employees}
    />
  );
}
