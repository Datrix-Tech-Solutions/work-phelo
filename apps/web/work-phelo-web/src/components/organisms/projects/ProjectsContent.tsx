'use client';

interface Props {
  tenantSlug: string;
}

export function ProjectsContent({ tenantSlug }: Props) {
  void tenantSlug;

  return (
    <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-bold text-gray-900">Projects & Tasks Unavailable</h1>
        <p className="mt-2 text-sm text-gray-500">
          Project and task management has been removed from the live permission workflow until the
          backend APIs and RBAC enforcement are fully implemented.
        </p>
      </div>
    </div>
  );
}
