'use client';

import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { SortableList, SortableListItem } from '@/components/organisms/shared/SortableList';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { RenameInUseModal } from '@/components/organisms/marketing/RenameInUseModal';
import { useRenameInUseGuard } from '@/hooks/marketing/useRenameInUseGuard';
import {
  SalesPipelineStageForm,
  SalesPipelineStageFields,
} from '@/components/molecules/marketing/SalesPipelineStageForm';
import {
  useCreatePipelineStage,
  useDeletePipelineStage,
  usePipelineStages,
  useReorderPipelineStages,
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
  const renameGuard = useRenameInUseGuard('pipeline-stages');
  const deleteStage = useDeletePipelineStage();
  const reorderStages = useReorderPipelineStages();

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
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);

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
    else if (
      stageData.some(
        (i) => i.id !== editingId && i.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
      )
    )
      next.name = 'This stage already exists. Please enter a different name.';
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
      const original = stageData.find((i) => i.id === editingId);
      if (original && original.name !== name) {
        void renameGuard.guardRename(editingId).then((needsConfirm) => {
          if (!needsConfirm) saveUpdate();
        });
        return;
      }
      saveUpdate();
    }
  }

  function saveUpdate() {
    if (!editingId) return;
    const name = form.name.trim();
    const probability = Number(form.probability);
    updateStage.mutate(
      { id: editingId, name, probability },
      {
        onSuccess: () => {
          toast.success('Stage updated');
          renameGuard.closeConfirm();
          setModalOpen(false);
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update stage')),
      },
    );
  }

  function closeDelete() {
    setDeleteId(null);
    setInUseMessage(null);
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteStage.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Stage deleted');
        setDeleteId(null);
      },
      onError: (error) => {
        if (isAxiosError(error) && error.response?.status === 409) {
          setInUseMessage(apiErrorMessage(error, 'This item is in use and cannot be deleted.'));
          return;
        }
        toast.error(apiErrorMessage(error, 'Failed to delete stage'));
      },
    });
  }

  function handleReorder(orderedIds: string[]) {
    // While searching, the list shows only a subset; merge it back into the full order.
    const visible = new Set(orderedIds);
    let next = 0;
    const fullOrder = stageData.map((s) => (visible.has(s.id) ? orderedIds[next++] : s.id));
    const changes = fullOrder
      .map((id, displayOrder) => ({ id, displayOrder }))
      .filter((c) => stageData.find((s) => s.id === c.id)?.displayOrder !== c.displayOrder);
    if (changes.length === 0) return;
    reorderStages.mutate(changes, {
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to reorder stages')),
    });
  }

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
            <Button
              onClick={handleSave}
              isLoading={createStage.isPending || updateStage.isPending || renameGuard.isChecking}
            >
              {modalMode === 'add' ? 'Add Stage' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <SalesPipelineStageForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      <RenameInUseModal
        isOpen={renameGuard.confirmOpen}
        itemLabel="Sales stage"
        isLoading={updateStage.isPending}
        onConfirm={saveUpdate}
        onClose={renameGuard.closeConfirm}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={closeDelete}
        title="Delete Stage"
        description={
          inUseMessage ??
          'Are you sure you want to delete this stage? This action cannot be undone.'
        }
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={closeDelete}>
              Cancel
            </Button>
            {!inUseMessage && (
              <Button variant="danger" onClick={handleDelete} isLoading={deleteStage.isPending}>
                Delete
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
