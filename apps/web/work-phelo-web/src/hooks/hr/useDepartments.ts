import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Department } from '@/types/hr';

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/hr/departments').then((r) => r.data),
  });
}
