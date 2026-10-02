'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserDocument {
  id: string;
  userId: string;
  category: string;
  /** Short-lived signed read URL, resolved fresh on every fetch. */
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

const QUERY_KEY = ['users', 'me', 'documents'];

export function useMyDocuments() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<UserDocument[]>('/auth/users/me/documents');
      return res.data;
    },
  });
}

export function useUploadMyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('category', category);
      const res = await api.post<UserDocument>('/auth/users/me/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteMyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`/auth/users/me/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
