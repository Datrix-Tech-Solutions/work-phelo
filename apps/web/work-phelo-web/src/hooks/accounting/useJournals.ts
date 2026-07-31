import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateJournalPayload,
  JournalEntryRecord,
  QueryJournalsParams,
  ReverseJournalPayload,
  UpdateDraftJournalPayload,
} from '@/types/accounting';

const BASE = '/accounting/journals';
const JOURNALS_KEY = ['accounting', 'journals'] as const;

export function useJournals(params: QueryJournalsParams = {}) {
  return useQuery({
    queryKey: [...JOURNALS_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<JournalEntryRecord[]>(BASE, { params });
      return res.data;
    },
  });
}

export function useJournal(journalId: string | undefined) {
  return useQuery({
    queryKey: [...JOURNALS_KEY, journalId],
    queryFn: async () => {
      const res = await api.get<JournalEntryRecord>(`${BASE}/${journalId}`);
      return res.data;
    },
    enabled: !!journalId,
  });
}

export function useCreateJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateJournalPayload) => {
      const res = await api.post<JournalEntryRecord>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOURNALS_KEY });
    },
  });
}

export function useUpdateDraftJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateDraftJournalPayload & { id: string }) => {
      const res = await api.patch<JournalEntryRecord>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOURNALS_KEY });
    },
  });
}

export function usePostJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<JournalEntryRecord>(`${BASE}/${id}/post`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOURNALS_KEY });
    },
  });
}

export function useReverseJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ReverseJournalPayload & { id: string }) => {
      const res = await api.post<JournalEntryRecord>(`${BASE}/${id}/reverse`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOURNALS_KEY });
    },
  });
}
