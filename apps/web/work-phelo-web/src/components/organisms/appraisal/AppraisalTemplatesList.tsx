'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateTemplatePanel } from '@/components/organisms/appraisal/CreateTemplatePanel';
import { TemplatePreviewModal } from '@/components/organisms/appraisal/TemplatePreviewModal';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { AppraisalTemplate } from '@/types/hr';

interface Props {
  tenantSlug: string;
}

export function AppraisalTemplatesList({ tenantSlug }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<AppraisalTemplate | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AppraisalTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<AppraisalTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['appraisal-templates', tenantSlug, page, search],
    queryFn: () =>
      api
        .get('/hr/appraisals/templates', { params: { page, search: search || undefined } })
        .then((r) => r.data),
  });

  const templates: AppraisalTemplate[] = Array.isArray(data)
    ? data
    : (data?.data ?? data?.templates ?? []);
  const totalPages: number = data?.totalPages ?? 1;

  const { mutate: deleteTemplate, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisals/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates', tenantSlug] });
      toast.success('Template deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(extractError(err, 'Failed to delete template'));
      setDeleteTarget(null);
    },
  });

  const columns: Column<AppraisalTemplate>[] = [
    {
      key: 'name',
      label: 'Template Name',
      width: '2fr',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'sections',
      label: 'Sections',
      width: '100px',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {row.sections.length} section{row.sections.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      width: '100px',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${row.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '120px',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {new Date(row.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
  ];

  const rowActions = (row: AppraisalTemplate) => [
    { label: 'Preview', onClick: () => setPreviewTarget(row) },
    {
      label: 'Edit',
      onClick: () => {
        setEditTemplate(row);
        setPanelOpen(true);
      },
    },
    { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        emptyMessage="No templates yet — create your first one"
        searchPlaceholder="Search templates..."
        onSearch={setSearch}
        actionButton={{
          label: 'New Template',
          onClick: () => {
            setEditTemplate(undefined);
            setPanelOpen(true);
          },
        }}
        rowActions={rowActions}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <CreateTemplatePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditTemplate(undefined);
        }}
        tenantSlug={tenantSlug}
        editTemplate={editTemplate}
      />

      {previewTarget && (
        <TemplatePreviewModal
          isOpen={!!previewTarget}
          onClose={() => setPreviewTarget(null)}
          templateName={previewTarget.name}
          sections={previewTarget.sections.map((s) => ({
            name: s.name,
            type: s.type,
            ratingScaleRange: s.ratingScaleRange,
            isRequired: s.isRequired,
          }))}
        />
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Template"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={() => deleteTarget && deleteTemplate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}
