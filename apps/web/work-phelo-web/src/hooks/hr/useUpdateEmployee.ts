import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UpdateEmployeePayload {
  firstName: string;
  lastName: string;
  phone?: string;
  jobTitle: string;
  departmentId?: string;
  employmentType: string;
  employmentStatus: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
  city?: string;
  region?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  basicSalary?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
}

interface Options {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

export function useUpdateEmployee(id: string, options?: Options) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateEmployeePayload) => api.patch(`/hr/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees-all'] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
