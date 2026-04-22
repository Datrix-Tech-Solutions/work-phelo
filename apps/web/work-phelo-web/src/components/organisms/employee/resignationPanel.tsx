'use client';

import { Employee } from '@/types';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '../shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';

interface ResignationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
}

interface ResignationForm {
  lastWorkingDay: string;
  resignationReason: string;
  otherReason: string;
  additionalNotes: string;
}

const REASON_OPTIONS = [
  { value: 'PERSONAL_REASON', label: 'Personal Reason' },
  { value: 'BETTER_OPPORTUNITY', label: 'Better Opportunity' },
  { value: 'RELOCATION', label: 'Relocation' },
  { value: 'OTHER', label: 'Other' },
];

export function ResignationPanel({ isOpen, onClose, employee }: ResignationPanelProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useForm<ResignationForm>();

  const resignationReason = useWatch({ control, name: 'resignationReason' });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Resignation"
      description={`${employee.firstName} ${employee.lastName}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled>Submit</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Resignation Details
        </p>
        <div className="flex flex-col gap-4">
          <Controller
            name="lastWorkingDay"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Last Working Day"
                value={field.value}
                onChange={field.onChange}
                disablePast
                error={errors.lastWorkingDay?.message}
              />
            )}
          />

          <Controller
            name="resignationReason"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Reason for Resignation"
                placeholder="Select reason"
                value={field.value}
                onChange={field.onChange}
                options={REASON_OPTIONS}
                error={errors.resignationReason?.message}
              />
            )}
          />

          {resignationReason === 'OTHER' && (
            <FormField
              label="Other Reason"
              registration={register('otherReason')}
              error={errors.otherReason}
              placeholder="Give your reason for resigning"
            />
          )}

          <FormField
            label="Additional Notes"
            registration={register('additionalNotes')}
            error={errors.additionalNotes}
            type="textarea"
            rows={5}
            placeholder="Enter any additional notes..."
          />
        </div>
      </div>
    </SidePanel>
  );
}
