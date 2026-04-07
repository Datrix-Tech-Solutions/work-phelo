import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Employee } from '@/types/hr';

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ['employees-all'],
    queryFn: () =>
      api
        .get('/hr/employees', { params: { limit: 200 } })
        .then((r) => r.data?.employees ?? r.data ?? []),
  });
}
