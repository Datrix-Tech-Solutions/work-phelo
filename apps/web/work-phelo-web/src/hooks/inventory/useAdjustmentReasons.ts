import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, inventoryKeys } from '@/hooks/inventory/inventoryApi';

export interface AdjustmentReason {
  id: string;
  /** What a movement stores. */
  code: string;
  name: string;
  isSystem: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

/** The company's adjustment reasons, and the action to add one. */
export function useAdjustmentReasons() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.adjustmentReasons,
    queryFn: () => inventoryApi.get<AdjustmentReason[]>('/adjustment-reasons'),
  });
  const create = useMutation({
    mutationFn: (name: string) =>
      inventoryApi.post<AdjustmentReason>('/adjustment-reasons', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.adjustmentReasons }),
  });
  return { reasons: data ?? [], isLoading, createReason: create.mutateAsync };
}
