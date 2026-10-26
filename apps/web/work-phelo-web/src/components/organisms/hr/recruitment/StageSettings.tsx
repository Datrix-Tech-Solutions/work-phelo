'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Modal } from '@/components/organisms/shared/Modal';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { usePermission } from '@/hooks/hr/usePermission';
import {
  useCreateStage,
  useDeleteStage,
  useRecruitmentStages,
  useUpdateStage,
} from '@/hooks/hr/useRecruitment';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Permission } from '@/lib/permissionMap';
import type { RecruitmentStage } from '@/types/recruitment';

/** What the system does with the stages it relies on. These cannot be renamed or deleted. */
const SYSTEM_ROLES: Record<string, string> = {
  screening: 'Candidates are screened here before moving to the next stage.',
  interview: 'Candidates move here when an interview is scheduled.',
  rejected: 'Applicants below a job opening’s cut-off are moved here.',
};

function systemRole(stage: RecruitmentStage): string | null {
  if (stage.isDefault) return 'New applications start here.';
  return SYSTEM_ROLES[stage.name.trim().toLowerCase()] ?? null;
}

type FormState = { stage: RecruitmentStage | null; name: string; description: string };

export function StageSettings() {
  const toast = useToast();
  const canCreate = usePermission(Permission.CREATE_RECRUITMENT_STAGE);
  const canUpdate = usePermission(Permission.UPDATE_RECRUITMENT_STAGE);
  const canDelete = usePermission(Permission.DELETE_RECRUITMENT_STAGE);

  const { data: stages = [], isLoading } = useRecruitmentStages();
  const { mutate: createStage, isPending: isCreating } = useCreateStage();
  const { mutate: updateStage, isPending: isUpdating } = useUpdateStage();
  const { mutate: deleteStage, isPending: isDeleting } = useDeleteStage();

  const [form, setForm] = useState<FormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecruitmentStage | null>(null);

  const rows = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const editing = form?.stage ?? null;
  const locked = editing ? systemRole(editing) !== null : false;

  const columns: Column<RecruitmentStage>[] = [
    {
      key: 'order',
      label: '#',
      width: '60px',
      render: (_row) => <span className="text-sm text-gray-500">{rows.indexOf(_row) + 1}</span>,
    },
    {
      key: 'name',
      label: 'Stage',
      width: 'minmax(160px, 1fr)',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{row.name}</span>
          {systemRole(row) && <Badge label="Default" variant="info" />}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(320px, 4fr)',
      render: (row) => {
        const role = systemRole(row);
        if (!row.description && !role) return <span className="text-sm text-gray-400">—</span>;
        return (
          <div className="flex flex-col">
            {row.description && <span className="text-sm text-gray-600">{row.description}</span>}
            {role && <span className="text-xs text-gray-500">{role}</span>}
          </div>
        );
      },
    },
  ];

  const rowActions = (row: RecruitmentStage): RowAction[] => [
    ...(canUpdate
      ? [
          {
            label: 'Edit',
            onClick: () =>
              setForm({ stage: row, name: row.name, description: row.description ?? '' }),
          },
        ]
      : []),
    ...(canDelete && !systemRole(row)
      ? [{ label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) }]
      : []),
  ];

  const save = () => {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error('Enter a stage name of at least 2 characters');
      return;
    }
    const description = form.description.trim();
    const done = {
      onSuccess: () => {
        toast.success(editing ? 'Stage updated' : 'Stage added');
        setForm(null);
      },
      onError: (err: unknown) => toast.error(extractError(err, 'Failed to save stage')),
    };
    if (editing) {
      updateStage({ id: editing.id, ...(locked ? {} : { name }), description }, done);
    } else {
      createStage({ name, description: description || undefined }, done);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteStage(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Stage deleted');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete stage')),
    });
  };

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        rowActions={rowActions}
        singleActionAsButton={false}
        emptyMessage="No stages yet"
        {...(canCreate && {
          actionButton: {
            label: 'Add Stage',
            onClick: () => setForm({ stage: null, name: '', description: '' }),
          },
        })}
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />

      <Modal
        isOpen={!!form}
        onClose={() => setForm(null)}
        title={editing ? 'Edit Stage' : 'Add Stage'}
        description={
          locked
            ? 'The system relies on this stage’s name, so only the description can change.'
            : undefined
        }
      >
        {form && (
          <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
            <Input
              label="Stage name"
              value={form.name}
              disabled={locked}
              maxLength={80}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, name: e.target.value })
              }
            />
            <Input
              type="textarea"
              label="Description"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button onClick={save} isLoading={isCreating || isUpdating} loadingText="Saving…">
                {editing ? 'Save' : 'Add Stage'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Stage"
        description={`Delete "${deleteTarget?.name ?? ''}"? This can't be undone, and a stage that has been used by candidates can't be deleted.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting…"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </div>
        }
      />
    </div>
  );
}
