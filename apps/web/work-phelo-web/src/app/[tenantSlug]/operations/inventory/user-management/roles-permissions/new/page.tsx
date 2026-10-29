'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { RoleFormFields, RoleFormValues } from '@/components/molecules/roles/RoleFormFields';
import { useCreatePermissionSet } from '@/hooks/hr/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

export default function NewInventoryRolePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const base = `/${tenantSlug}/operations/inventory/user-management/roles-permissions`;

  const toast = useToast();

  const { mutate: createSet, isPending } = useCreatePermissionSet();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleFormValues>({ defaultValues: { name: '', description: '' } });

  const onValid = (values: RoleFormValues) => {
    createSet(
      {
        name: values.name,
        description: values.description || undefined,
        resources: [],
      },
      {
        onSuccess: () => {
          toast.success('Permission set created');
          router.push(base);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to create permission set')),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Roles &amp; Permissions
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">New Permission Set</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">New Permission Set</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Create a role that can be assigned to users. Permissions will be added once inventory
            permissions are available.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => router.push(base)} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Creating..." onClick={handleSubmit(onValid)}>
            Create Set
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
