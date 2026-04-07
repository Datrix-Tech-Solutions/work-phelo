import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Employee } from '@/types/hr';

export function useEmployee(id: string) {
  return useQuery<Employee>({
    queryKey: ['employee', id],
    queryFn: () => api.get(`/hr/employees/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}
