'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/lib/icons';

interface CompanyHeaderProps {
  id: string;
  name: string;
  slug: string;
  status: string;
}

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
          <Icons.Trash2 className="w-5 h-5" />
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
            <Icons.CircleCheck className="w-5 h-5" />
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
            <Icons.CircleX className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
