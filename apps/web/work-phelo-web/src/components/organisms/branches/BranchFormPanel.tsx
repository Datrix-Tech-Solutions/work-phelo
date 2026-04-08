'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useCreateBranch, useUpdateBranch } from '@/hooks';
import { SuccessModal } from '@/components/organisms/SuccessModal';
import type { Branch, Employee } from '@/types/hr';

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

export function BranchFormPanel({ isOpen, onClose, branch, employees }: BranchFormPanelProps) {
  const isEditMode = !!branch;
  const toast = useToast();
  const [successBranch, setSuccessBranch] = useState<string | null>(null);

  const form = useForm<BranchForm>({
    defaultValues: {
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

  // Populate form when editing, reset when creating
  useEffect(() => {
    if (isOpen) {
      form.reset(
        branch
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
      );
    }
  }, [isOpen, branch, form]);

  const { mutate: createBranch, isPending: isCreating } = useCreateBranch();
  const { mutate: updateBranch, isPending: isUpdating } = useUpdateBranch();
  const isPending = isCreating || isUpdating;

  const handleClose = () => {
    form.reset();
    onClose();
  };

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
            handleClose();
          },
          onError: (err) => toast.error(extractError(err, 'Failed to update branch')),
        },
      );
    } else {
      createBranch(payload, {
        onSuccess: () => {
          setSuccessBranch(data.name);
          handleClose();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to create branch')),
      });
    }
  });

  const managerOptions = [
    { value: '', label: 'No manager assigned' },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName}`,
      sublabel: e.jobTitle,
    })),
  ];

  return (
    <>
      <SuccessModal
        isOpen={!!successBranch}
        onClose={() => setSuccessBranch(null)}
        title="Branch Created!"
        message={`"${successBranch}" has been added to your organisation.`}
      />
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title={isEditMode ? 'Edit Branch' : 'New Branch'}
        description={
          isEditMode
            ? `Editing "${branch.name}"`
            : 'Add a new office location to your organisation.'
        }
        width="w-[480px]"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
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
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</p>
          <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-input border border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Phone"
                registration={form.register('phone')}
                placeholder="e.g. +233 30 000 0000"
              />
              <FormField
                label="Email"
                registration={form.register('email')}
                type="email"
                placeholder="e.g. accra@company.com"
              />
            </div>
          </div>
        </div>

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
            className="w-4 h-4 rounded accent-[#0D2244]"
          />
          <label
            htmlFor="isHeadOffice"
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            This is the Head Office
          </label>
        </div>
      </SidePanel>
    </>
  );
}
