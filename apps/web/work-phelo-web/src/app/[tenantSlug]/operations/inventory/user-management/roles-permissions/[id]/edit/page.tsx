'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { RoleFormFields, RoleFormValues } from '@/components/molecules/roles/RoleFormFields';
import { usePermissionSets, useUpdatePermissionSet } from '@/hooks/hr/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

export default function EditInventoryRolePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const base = `/${tenantSlug}/operations/inventory/user-management/roles-permissions`;

  const { data: sets = [], isLoading } = usePermissionSets();
  const set = sets.find((s) => s.id === id);
  const { mutate: updateSet, isPending } = useUpdatePermissionSet();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({ defaultValues: { name: '', description: '' } });

  useEffect(() => {
    if (set) reset({ name: set.name, description: set.description ?? '' });
  }, [set, reset]);

  const onValid = (values: RoleFormValues) => {
    if (!set) return;

    // Keep whatever the role already holds; inventory has no permissions to change yet.
    const preserved = set.resources.map((r) => ({ resourceId: r.resourceId, action: r.action }));

    updateSet(
      {
        id,
        name: values.name,
        description: values.description || undefined,
        resources: preserved,
      },
      {
        onSuccess: () => {
          toast.success('Permission set updated');
          router.push(base);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to update permission set')),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!set) {
    return <div className="text-sm text-gray-500">Permission set not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Roles &amp; Permissions
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{set.name}</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Edit Permission Set</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Update the name and description of this role.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => router.push(base)} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onValid)}>
            Save Changes
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8 lg:items-start">
        <div className="w-full lg:w-96 lg:shrink-0 flex flex-col gap-5">
          <RoleFormFields register={register} errors={errors} />
        </div>
      </div>
    </div>
  );
}
