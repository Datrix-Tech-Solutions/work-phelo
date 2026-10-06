import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PayComponent, SavedPayComponent } from '@/lib/payroll-engine';

const KEY = ['payroll', 'saved-components'];

/** The user's reusable pay components. */
export function useSavedPayComponents() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<SavedPayComponent[]>('/hr/payroll-saved-components');
      return res.data;
    },
  });

  const saveAsNew = useMutation({
    mutationFn: async (component: PayComponent) => {
      const res = await api.post<SavedPayComponent>('/hr/payroll-saved-components', {
        name: component.name,
        component,
      });
      return res.data;
    },
    onSuccess: refresh,
  });

  const replace = useMutation({
    mutationFn: async ({ id, component }: { id: string; component: PayComponent }) => {
      const res = await api.put<SavedPayComponent>(`/hr/payroll-saved-components/${id}`, {
        name: component.name,
        component,
      });
      return res.data;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/payroll-saved-components/${id}`);
    },
    onSuccess: refresh,
  });

  return {
    saved: query.data ?? [],
    /** Saves a copy as a new entry and resolves to its id. */
    saveAsNew: async (component: PayComponent) => (await saveAsNew.mutateAsync(component)).id,
    replace: (id: string, component: PayComponent) => replace.mutateAsync({ id, component }),
    remove: (id: string) => remove.mutateAsync(id),
  };
}
