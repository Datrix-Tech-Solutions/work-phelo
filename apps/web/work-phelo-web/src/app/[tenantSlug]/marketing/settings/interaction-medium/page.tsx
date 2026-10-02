'use client';

import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { RenameInUseModal } from '@/components/organisms/marketing/RenameInUseModal';
import { useRenameInUseGuard } from '@/hooks/marketing/useRenameInUseGuard';
import {
  InteractionMediumForm,
  InteractionMediumFields,
} from '@/components/molecules/marketing/InteractionMediumForm';
import {
  useCreateProspectingSetting,
  useDeleteProspectingSetting,
  useProspectingSettings,
  useUpdateProspectingSetting,
} from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

const EMPTY_FORM: InteractionMediumFields = { name: '', description: '' };
type PanelMode = 'add' | 'edit';

export default function InteractionMediumPage() {
  const toast = useToast();
  const { data: itemData = [], isLoading, isError } = useProspectingSettings('interaction-media');
  const createItem = useCreateProspectingSetting('interaction-media');
  const updateItem = useUpdateProspectingSetting('interaction-media');
  const renameGuard = useRenameInUseGuard('interaction-media');
  const deleteItem = useDeleteProspectingSetting('interaction-media');

  const items: CardListItem[] = useMemo(
    () => itemData.map((i) => ({ id: i.id, label: i.name, sublabel: i.description ?? undefined })),
    [itemData],
  );
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InteractionMediumFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<InteractionMediumFields>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);

  const filtered = items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelMode('add');
    setEditingId(null);
    setPanelOpen(true);
  }

  function openEdit(id: string) {
    const item = itemData.find((i) => i.id === id);
    if (!item) return;
    setForm({ name: item.name, description: item.description ?? '' });
    setErrors({});
    setPanelMode('edit');
    setEditingId(id);
    setPanelOpen(true);
  }

  function validate(): boolean {
    const next: Partial<InteractionMediumFields> = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    else if (
      itemData.some(
        (i) => i.id !== editingId && i.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
      )
    )
      next.name = 'This interaction medium already exists. Please enter a different name.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const name = form.name.trim();
    const description = form.description.trim();

    if (panelMode === 'add') {
      createItem.mutate(
        // Omit an empty description on create; on edit it is sent so the field can be cleared.
        { name, ...(description ? { description } : {}), displayOrder: itemData.length },
        {
          onSuccess: () => {
            toast.success('Interaction medium added');
            setPanelOpen(false);
          },
          onError: (error) =>
            toast.error(apiErrorMessage(error, 'Failed to add interaction medium')),
        },
      );
    } else if (editingId) {
      const original = itemData.find((i) => i.id === editingId);
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
    const description = form.description.trim();
    updateItem.mutate(
      { id: editingId, name, description },
      {
        onSuccess: () => {
          toast.success('Interaction medium updated');
          renameGuard.closeConfirm();
          setPanelOpen(false);
        },
        onError: (error) =>
          toast.error(apiErrorMessage(error, 'Failed to update interaction medium')),
      },
    );
  }

  function closeDelete() {
    setDeleteId(null);
    setInUseMessage(null);
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteItem.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Interaction medium deleted');
        setDeleteId(null);
      },
      onError: (error) => {
        if (isAxiosError(error) && error.response?.status === 409) {
          setInUseMessage(apiErrorMessage(error, 'This item is in use and cannot be deleted.'));
          return;
        }
        toast.error(apiErrorMessage(error, 'Failed to delete interaction medium'));
      },
    });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading interaction mediums...</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-red-500 text-center py-8">Failed to load interaction mediums.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CardList
        title="Interaction Mediums"
        addLabel="Add Interaction Medium"
        items={filtered}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(id) => setDeleteId(id)}
        searchValue={search}
        onSearchChange={setSearch}
      />

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelMode === 'add' ? 'Add Interaction Medium' : 'Edit Interaction Medium'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              isLoading={createItem.isPending || updateItem.isPending || renameGuard.isChecking}
            >
              {panelMode === 'add' ? 'Add Interaction Medium' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <InteractionMediumForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      <RenameInUseModal
        isOpen={renameGuard.confirmOpen}
        itemLabel="Interaction medium"
        isLoading={updateItem.isPending}
        onConfirm={saveUpdate}
        onClose={renameGuard.closeConfirm}
      />

      <Modal
        isOpen={!!deleteId}
        onClose={closeDelete}
        title="Delete Interaction Medium"
        description={
          inUseMessage ??
          'Are you sure you want to delete this interaction medium? This action cannot be undone.'
        }
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={closeDelete}>
              Cancel
            </Button>
            {!inUseMessage && (
              <Button variant="danger" onClick={handleDelete} isLoading={deleteItem.isPending}>
                Delete
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
