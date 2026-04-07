'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { CreateLeaveTypeDto, LeaveType, LeaveApplicability } from '@/types/leave';
import { api } from '@/lib/api';

interface CreateLeaveTypePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug?: string;
  editLeaveType?: LeaveType;
}

const APPLICABILITY_OPTIONS: { value: LeaveApplicability; label: string }[] = [
  { value: 'All', label: 'All Employees' },
  { value: 'FullTime', label: 'Full-time' },
  { value: 'PartTime', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
];

export function CreateLeaveTypePanel({
  isOpen,
  onClose,
  tenantSlug,
  editLeaveType,
}: CreateLeaveTypePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editLeaveType;

  const form = useForm<CreateLeaveTypeDto>({
    defaultValues: {
      name: '',
      description: '',
      isPaid: true,
      daysPerYear: 10,
      carryOver: false,
      maxCarryOverDays: undefined,
      requiresDocumentation: false,
      documentationDescription: '',
      applicableTo: ['All'],
    },
  });

  // Reset form when editing
  useEffect(() => {
    if (editLeaveType) {
      form.reset({
        name: editLeaveType.name,
        description: editLeaveType.description || '',
        isPaid: editLeaveType.isPaid,
        daysPerYear: editLeaveType.daysPerYear,
        carryOver: editLeaveType.carryOver,
        maxCarryOverDays: editLeaveType.maxCarryOverDays,
        requiresDocumentation: editLeaveType.requiresDocumentation,
        documentationDescription: editLeaveType.documentationDescription || '',
        applicableTo: editLeaveType.applicableTo,
      });
    } else {
      form.reset();
    }
  }, [editLeaveType, form]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateLeaveTypeDto) => {
      const payload = {
        name: data.name,
        isPaid: data.isPaid,
        daysAllowed: data.daysPerYear,
      };

      return isEditing
        ? api.patch(`/hr/leave/types/${editLeaveType!.id}`, payload)
        : api.post('/hr/leave/types', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success(
        isEditing ? 'Leave type updated successfully' : 'Leave type created successfully',
      );
      onClose();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Something went wrong';
      toast.error(message);
    },
  });

  const onSubmit = (data: CreateLeaveTypeDto) => {
    if (data.applicableTo.length === 0) {
      toast.error('Please select at least one applicability option');
      return;
    }
    mutate(data);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Leave Type' : 'Create New Leave Type'}
      description="Define leave policy, entitlements, and rules."
      width="w-[520px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Saving..."
            onClick={form.handleSubmit(onSubmit)}
          >
            {isEditing ? 'Save Changes' : 'Create Leave Type'}
          </Button>
        </div>
      }
    >
      <FormField
        label="Leave Type Name"
        registration={form.register('name', { required: 'Name is required' })}
        error={form.formState.errors.name}
        placeholder="e.g. Annual Leave"
      />

      <FormField
        label="Description"
        registration={form.register('description')}
        placeholder="Optional description"
        type="textarea"
        // rows={3}
      />

      <SearchSelect
        label="Is this paid leave?"
        value={form.watch('isPaid') ? 'yes' : 'no'}
        onChange={(val) => form.setValue('isPaid', val === 'yes')}
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
      />

      <FormField
        label="Days Entitled Per Year"
        registration={form.register('daysPerYear', {
          required: 'Required',
          min: { value: 1, message: 'Must be at least 1 day' },
        })}
        type="number"
        error={form.formState.errors.daysPerYear}
      />

      {/* Carry Over Section */}
      <div className="space-y-3">
        <SearchSelect
          label="Allow Carry Over?"
          value={form.watch('carryOver') ? 'yes' : 'no'}
          onChange={(val) => form.setValue('carryOver', val === 'yes')}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />

        {form.watch('carryOver') && (
          <FormField
            label="Maximum Carry Over Days"
            registration={form.register('maxCarryOverDays', { min: 0 })}
            type="number"
            placeholder="e.g. 5"
          />
        )}
      </div>

      {/* Documentation Section */}
      <div className="space-y-3">
        <SearchSelect
          label="Requires Documentation?"
          value={form.watch('requiresDocumentation') ? 'yes' : 'no'}
          onChange={(val) => form.setValue('requiresDocumentation', val === 'yes')}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />

        {form.watch('requiresDocumentation') && (
          <FormField
            label="Documentation Requirements"
            registration={form.register('documentationDescription')}
            placeholder="Describe what documents are needed..."
            type="textarea"
            // rows={3}
          />
        )}
      </div>

      {/* Applicable To */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-gray-900">Applicable To</label>
        <div className="flex flex-col gap-2">
          {APPLICABILITY_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer ">
              <input
                type="checkbox"
                checked={form.watch('applicableTo').includes(option.value)}
                onChange={(e) => {
                  const current = form.watch('applicableTo');
                  if (e.target.checked) {
                    form.setValue('applicableTo', [...current, option.value]);
                  } else {
                    form.setValue(
                      'applicableTo',
                      current.filter((v) => v !== option.value),
                    );
                  }
                }}
                className="w-4 h-4 accent-[#0D2244]"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </SidePanel>
  );
}
