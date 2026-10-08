import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PayrollGroup, PayrollGroupInput } from '@/lib/payroll-groups';

const KEY = ['payroll', 'groups'];

/** The payroll groups: sets of employees paid the same way. */
export function usePayrollGroups() {
  const queryClient = useQueryClient();
  // Waits for the refreshed list, so a saved group is there when the save resolves.
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<PayrollGroup[]>('/hr/payroll-groups');
      return res.data;
    },
  });

  /** Creates the group, or updates it when the input has an id. */
  const save = useMutation({
    mutationFn: async ({ id, ...body }: PayrollGroupInput) => {
      const res = id
        ? await api.put<PayrollGroup>(`/hr/payroll-groups/${id}`, body)
        : await api.post<PayrollGroup>('/hr/payroll-groups', body);
      return res.data;
    },
    onSuccess: refresh,
  });

  /** Sets who is in a group; anyone listed is moved out of the group they were in. */
  const setEmployees = useMutation({
    mutationFn: async ({ id, employeeIds }: { id: string; employeeIds: string[] }) => {
      await api.put(`/hr/payroll-groups/${id}/employees`, { employeeIds });
    },
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['employees'] })]);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/payroll-groups/${id}`);
    },
    onSuccess: refresh,
  });

  return {
    groups: query.data ?? [],
    isLoading: query.isLoading,
    save: save.mutateAsync,
    setEmployees: (id: string, employeeIds: string[]) =>
      setEmployees.mutateAsync({ id, employeeIds }),
    isSaving: save.isPending || setEmployees.isPending,
    remove: async (id: string) => {
      await remove.mutateAsync(id);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  };
}
