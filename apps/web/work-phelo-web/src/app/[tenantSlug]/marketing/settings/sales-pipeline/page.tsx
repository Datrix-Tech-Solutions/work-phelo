'use client';

import { useMemo, useState } from 'react';
import { SortableList, SortableListItem } from '@/components/organisms/shared/SortableList';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  SalesPipelineStageForm,
  SalesPipelineStageFields,
} from '@/components/molecules/marketing/SalesPipelineStageForm';
import {
  useCreatePipelineStage,
  useDeletePipelineStage,
  usePipelineStages,
  useUpdatePipelineStage,
} from '@/hooks/marketing/usePipelineStages';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

const EMPTY_FORM: SalesPipelineStageFields = { name: '', probability: '' };

type ModalMode = 'add' | 'edit';

export default function SalesPipelinePage() {
  const toast = useToast();
  const { data: stageData = [], isLoading, isError } = usePipelineStages();
  const createStage = useCreatePipelineStage();
  const updateStage = useUpdatePipelineStage();
  const deleteStage = useDeletePipelineStage();

  const stages: SortableListItem[] = useMemo(
    () =>
      stageData.map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: `${s.probability}% Probability of achieving sales`,
      })),
    [stageData],
  );
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SalesPipelineStageFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<SalesPipelineStageFields>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = stages.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setModalMode('add');
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const stage = stageData.find((s) => s.id === id);
    if (!stage) return;
    setForm({ name: stage.name, probability: String(stage.probability) });
    setErrors({});
    setModalMode('edit');
    setEditingId(id);
    setModalOpen(true);
  }

  function validate(): boolean {
    const next: Partial<SalesPipelineStageFields> = {};
    if (!form.name.trim()) next.name = 'Stage name is required.';
    if (form.probability === '' || Number(form.probability) < 0 || Number(form.probability) > 100)
      next.probability = 'Enter a value between 0 and 100.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const name = form.name.trim();
    const probability = Number(form.probability);

    if (modalMode === 'add') {
      createStage.mutate(
        { name, probability, displayOrder: stageData.length },
        {
          onSuccess: () => {
            toast.success('Stage added');
            setModalOpen(false);
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to add stage')),
        },
      );
    } else if (editingId) {
      updateStage.mutate(
        { id: editingId, name, probability },
        {
          onSuccess: () => {
            toast.success('Stage updated');
            setModalOpen(false);
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update stage')),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteStage.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Stage deleted');
        setDeleteId(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete stage')),
    });
  }

  // TODO: persist reordering (on hold) — until then a drag snaps back to the server order.
  function handleReorder() {}

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading pipeline stages...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500 text-center py-8">Failed to load pipeline stages.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <SortableList
        title="Sales Pipeline"
        addLabel="Add Stage"
        items={filtered}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(id) => setDeleteId(id)}
        onReorder={handleReorder}
        searchValue={search}
        onSearchChange={setSearch}
      />

      {/* Add / Edit side panel */}
      <SidePanel
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'add' ? 'Add Stage' : 'Edit Stage'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={createStage.isPending || updateStage.isPending}>
              {modalMode === 'add' ? 'Add Stage' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <SalesPipelineStageForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Stage"
        description="Are you sure you want to delete this stage? This action cannot be undone."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteStage.isPending}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
