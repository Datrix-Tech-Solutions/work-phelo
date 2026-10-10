'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useUpdateLabels } from '@/hooks/useModuleConfig';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { buildModuleLabels, DEFAULT_PROJECT_LABEL } from '@/lib/moduleLabels';

const MAX_LENGTH = 30;
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} &'-]*$/u;

interface TenantProjectsLabelProps {
  tenantId: string;
  /** The name currently saved for this company; empty when none was set. */
  savedName: string;
}

export function TenantProjectsLabel({ tenantId, savedName }: TenantProjectsLabelProps) {
  const toast = useToast();
  const updateLabels = useUpdateLabels(tenantId);
  const [name, setName] = useState(savedName);

  useEffect(() => {
    setName(savedName);
  }, [savedName]);

  const trimmed = name.trim();
  const error =
    trimmed.length > MAX_LENGTH
      ? `Keep it to ${MAX_LENGTH} characters or fewer.`
      : trimmed && !NAME_PATTERN.test(trimmed)
        ? 'Use letters, numbers, spaces, & and hyphens only.'
        : undefined;
  const dirty = trimmed !== savedName;
  const preview = buildModuleLabels(trimmed, DEFAULT_PROJECT_LABEL);

  function handleSave() {
    if (error) return;
    updateLabels.mutate(
      { projects: trimmed },
      {
        onSuccess: () => toast.success('Name updated'),
        onError: (e) => toast.error(apiErrorMessage(e, 'Failed to update name')),
      },
    );
  }

  return (
    <section className="rounded-card border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Projects name</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          What this company calls a project, in the singular. The plural adds an &quot;s&quot;.
          Leave blank to use &quot;{DEFAULT_PROJECT_LABEL}&quot;.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="max-w-sm">
          <Input
            label="Name"
            value={name}
            maxLength={MAX_LENGTH + 10}
            placeholder={DEFAULT_PROJECT_LABEL}
            error={error}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <p className="text-sm text-gray-500">
          Shown as <span className="font-medium text-gray-900">{preview.management}</span>, with
          lists titled <span className="font-medium text-gray-900">{preview.plural}</span>.
        </p>
        <div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || Boolean(error)}
            isLoading={updateLabels.isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}
