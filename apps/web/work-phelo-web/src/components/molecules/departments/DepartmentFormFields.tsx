import { UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { Employee } from '@/types/hr';

export interface DeptForm {
  name: string;
  description?: string;
  managerId?: string;
}

interface DepartmentFormFieldsProps {
  form: UseFormReturn<DeptForm>;
  employees: Employee[];
}

export function DepartmentFormFields({ form, employees }: DepartmentFormFieldsProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <FormField
        label="Department Name"
        registration={register('name', { required: 'Name is required' })}
        error={errors.name}
        placeholder="eg. Human Resources"
      />
      <FormField
        label="Description"
        registration={register('description')}
        placeholder="Brief description of the department"
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Department Head</label>
        <select
          {...register('managerId')}
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
    </>
  );
}
