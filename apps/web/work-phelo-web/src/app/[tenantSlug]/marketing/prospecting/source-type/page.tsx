'use client';

import { useMemo, useState } from 'react';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SourceTypeForm, SourceTypeFields } from '@/components/molecules/marketing/SourceTypeForm';
import {
  useCreateProspectingSetting,
  useDeleteProspectingSetting,
  useProspectingSettings,
  useUpdateProspectingSetting,
} from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

const EMPTY_FORM: SourceTypeFields = { name: '', description: '' };
type PanelMode = 'add' | 'edit';

export default function SourceTypePage() {
  const toast = useToast();
  const { data: itemData = [], isLoading, isError } = useProspectingSettings('source-types');
  const createItem = useCreateProspectingSetting('source-types');
  const updateItem = useUpdateProspectingSetting('source-types');
  const deleteItem = useDeleteProspectingSetting('source-types');

  const items: CardListItem[] = useMemo(
    () => itemData.map((i) => ({ id: i.id, label: i.name, sublabel: i.description ?? undefined })),
    [itemData],
  );
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceTypeFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<SourceTypeFields>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    const next: Partial<SourceTypeFields> = {};
    if (!form.name.trim()) next.name = 'Name is required.';
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
            toast.success('Source type added');
            setPanelOpen(false);
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to add source type')),
        },
      );
    } else if (editingId) {
      updateItem.mutate(
        { id: editingId, name, description },
        {
          onSuccess: () => {
            toast.success('Source type updated');
            setPanelOpen(false);
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update source type')),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteItem.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Source type deleted');
        setDeleteId(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete source type')),
    });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading source types...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500 text-center py-8">Failed to load source types.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <CardList
        title="Source Types"
        addLabel="Add Source Type"
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
        title={panelMode === 'add' ? 'Add Source Type' : 'Edit Source Type'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={createItem.isPending || updateItem.isPending}>
              {panelMode === 'add' ? 'Add Source Type' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <SourceTypeForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Source Type"
        description="Are you sure you want to delete this source type? This action cannot be undone."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteItem.isPending}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
