'use client';

import { Employee } from '@/types';
import { useForm } from 'react-hook-form';
import { SidePanel } from '../shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { cn, inputClass } from '@/lib/utils';

interface ResignationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
}

interface ResignationForm {
  reason: string;
}

export function ResignationPanel({ isOpen, onClose, employee }: ResignationPanelProps) {
  const {
    register,
    formState: { errors },
  } = useForm<ResignationForm>();

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
          <Button>Submit</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Resignation Details
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Reason for resignation</label>
          <textarea
            {...register('reason')}
            rows={5}
            placeholder="Enter reason..."
            className={cn(inputClass(), 'resize-none')}
          />
          {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
        </div>
      </div>
    </SidePanel>
  );
}
