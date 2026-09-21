import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateRecurringJournalPayload,
  JournalEntryRecord,
  RecurringJournalRecord,
  RecurringJournalStatus,
} from '@/types/accounting';

const BASE = '/accounting/recurring-journals';
const RECURRING_KEY = ['accounting', 'recurring-journals'] as const;

export function useRecurringJournals(status?: RecurringJournalStatus) {
  return useQuery({
    queryKey: [...RECURRING_KEY, 'list', status ?? null],
    queryFn: async () =>
      (await api.get<RecurringJournalRecord[]>(BASE, { params: { status } })).data,
  });
}

export function useCreateRecurringJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRecurringJournalPayload) =>
      (await api.post<RecurringJournalRecord>(BASE, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECURRING_KEY }),
  });
}

type Action = 'pause' | 'resume' | 'cancel';

export function useRecurringJournalAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: Action }) =>
      (await api.post<RecurringJournalRecord>(`${BASE}/${id}/${action}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECURRING_KEY }),
  });
}

/** Generates the next scheduled journal now and moves the schedule on. */
export function useRunRecurringJournalNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await api.post<{ journal: JournalEntryRecord; recurring: RecurringJournalRecord }>(
          `${BASE}/${id}/run-now`,
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY });
      // The generated journal shows up in the journal list.
      queryClient.invalidateQueries({ queryKey: ['accounting', 'journals'] });
    },
  });
}
