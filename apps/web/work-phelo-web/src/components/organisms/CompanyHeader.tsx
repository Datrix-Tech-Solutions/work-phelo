'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/atoms/Button';

interface CompanyHeaderProps {
  id: string;
  name: string;
  slug: string;
  status: string;
}

const TrashIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const EditIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export function CompanyHeader({ id, name, slug, status }: CompanyHeaderProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', id] });
  };

  const { mutate: deactivate, isPending: isDeactivating } = useMutation({
    mutationFn: () => api.patch(`/auth/tenants/${id}/deactivate`),
    onSuccess: invalidate,
  });

  const { mutate: activate, isPending: isActivating } = useMutation({
    mutationFn: () => api.patch(`/auth/tenants/${id}/approve`),
    onSuccess: invalidate,
  });

  const { mutate: deleteTenant, isPending: isDeleting } = useMutation({
    mutationFn: () => api.delete(`/auth/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      router.push('/dashboard');
    },
  });

  const isSuspended = status === 'SUSPENDED';
  const workspaceUrl = `workphelo.com/${slug}/`;

  return (
    <div className="flex items-center justify-between px-5 py-4 bg-white border border-gray-200 rounded-card">
      {/* Left — name, status, url */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900">{name}</span>
          <StatusBadge status={status} />
        </div>
        <span className="text-sm text-gray-500">{workspaceUrl}</span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => deleteTenant()}
          isLoading={isDeleting}
          loadingText="Deleting..."
          className="gap-2"
        >
          Delete Company
          <TrashIcon />
        </Button>
        {isSuspended ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => activate()}
            isLoading={isActivating}
            loadingText="Activating..."
            className="gap-2"
          >
            Activate
            <EditIcon />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => deactivate()}
            isLoading={isDeactivating}
            loadingText="Deactivating..."
            className="gap-2"
          >
            Suspend
            <EditIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
