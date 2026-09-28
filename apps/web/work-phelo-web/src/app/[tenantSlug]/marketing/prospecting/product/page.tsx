'use client';

import { useMemo, useState } from 'react';
import { CardList, CardListItem } from '@/components/organisms/shared/CardList';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { ProductForm, ProductFields } from '@/components/molecules/marketing/ProductForm';
import {
  useCreateProspectingSetting,
  useDeleteProspectingSetting,
  useProspectingSettings,
  useUpdateProspectingSetting,
} from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

const EMPTY_FORM: ProductFields = { name: '', description: '' };

type PanelMode = 'add' | 'edit';

export default function ProductPage() {
  const toast = useToast();
  const { data: productData = [], isLoading, isError } = useProspectingSettings('products');
  const createProduct = useCreateProspectingSetting('products');
  const updateProduct = useUpdateProspectingSetting('products');
  const deleteProduct = useDeleteProspectingSetting('products');

  const products: CardListItem[] = useMemo(
    () =>
      productData.map((p) => ({ id: p.id, label: p.name, sublabel: p.description ?? undefined })),
    [productData],
  );
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<ProductFields>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = products.filter((p) => p.label.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelMode('add');
    setEditingId(null);
    setPanelOpen(true);
  }

  function openEdit(id: string) {
    const product = productData.find((p) => p.id === id);
    if (!product) return;
    setForm({ name: product.name, description: product.description ?? '' });
    setErrors({});
    setPanelMode('edit');
    setEditingId(id);
    setPanelOpen(true);
  }

  function validate(): boolean {
    const next: Partial<ProductFields> = {};
    if (!form.name.trim()) next.name = 'Product name is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const name = form.name.trim();
    const description = form.description.trim();

    if (panelMode === 'add') {
      createProduct.mutate(
        // Omit an empty description on create; on edit it is sent so the field can be cleared.
        { name, ...(description ? { description } : {}), displayOrder: productData.length },
        {
          onSuccess: () => {
            toast.success('Product added');
            setPanelOpen(false);
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to add product')),
        },
      );
    } else if (editingId) {
      updateProduct.mutate(
        { id: editingId, name, description },
        {
          onSuccess: () => {
            toast.success('Product updated');
            setPanelOpen(false);
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update product')),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteProduct.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Product deleted');
        setDeleteId(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete product')),
    });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading products...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-500 text-center py-8">Failed to load products.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <CardList
        title="Products"
        addLabel="Add Product"
        items={filtered}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(id) => setDeleteId(id)}
        searchValue={search}
        onSearchChange={setSearch}
      />

      {/* Add / Edit side panel */}
      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelMode === 'add' ? 'Add Product' : 'Edit Product'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              isLoading={createProduct.isPending || updateProduct.isPending}
            >
              {panelMode === 'add' ? 'Add Product' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <ProductForm values={form} onChange={setForm} errors={errors} />
      </SidePanel>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteProduct.isPending}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
