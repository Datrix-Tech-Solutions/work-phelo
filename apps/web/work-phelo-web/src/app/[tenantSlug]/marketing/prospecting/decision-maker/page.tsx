'use client';

import { useMemo, useState } from 'react';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  DecisionMakerForm,
  DecisionMakerFields,
} from '@/components/molecules/marketing/DecisionMakerForm';
import {
  useCreateProspectingSetting,
  useDeleteProspectingSetting,
  useProspectingSettings,
  useUpdateProspectingSetting,
} from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

const EMPTY_FORM: DecisionMakerFields = { name: '', description: '' };

type PanelMode = 'add' | 'edit';

export default function DecisionMakerPage() {
  const toast = useToast();
  const { data: itemData = [], isLoading, isError } = useProspectingSettings('decision-makers');
  const createItem = useCreateProspectingSetting('decision-makers');
  const updateItem = useUpdateProspectingSetting('decision-makers');
  const deleteItem = useDeleteProspectingSetting('decision-makers');

  const items: CardListItem[] = useMemo(
    () => itemData.map((i) => ({ id: i.id, label: i.name, sublabel: i.description ?? undefined })),
    [itemData],
  );
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DecisionMakerFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<DecisionMakerFields>>({});

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
    const next: Partial<DecisionMakerFields> = {};
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
            toast.success('Decision maker added');
            setPanelOpen(false);
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to add decision maker')),
        },
      );
    } else if (editingId) {
      updateItem.mutate(
        { id: editingId, name, description },
        {
          onSuccess: () => {
            toast.success('Decision maker updated');
            setPanelOpen(false);
          },
          onError: (error) =>
            toast.error(apiErrorMessage(error, 'Failed to update decision maker')),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteItem.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Decision maker deleted');
        setDeleteId(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete decision maker')),
    });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading decision makers...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500 text-center py-8">Failed to load decision makers.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <CardList
        title="Decision Makers"
        addLabel="Add Decision Maker"
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
        title={panelMode === 'add' ? 'Add Decision Maker' : 'Edit Decision Maker'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={createItem.isPending || updateItem.isPending}>
              {panelMode === 'add' ? 'Add Decision Maker' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <DecisionMakerForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Decision Maker"
        description="Are you sure you want to delete this decision maker? This action cannot be undone."
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
