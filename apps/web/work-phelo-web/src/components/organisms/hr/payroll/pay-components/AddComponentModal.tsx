'use client';

import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  ADD_OPTIONS,
  KIND_LABELS,
  summarize,
  type ComponentTemplate,
  type SavedPayComponent,
} from '@/lib/payroll-engine';

interface AddComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  saved: SavedPayComponent[];
  onPick: (option: ComponentTemplate) => void;
  onPickSaved: (saved: SavedPayComponent) => void;
  onDeleteSaved: (id: string) => void;
}

const optionClass =
  'rounded-lg border border-gray-200 px-3 py-2 text-left transition-colors hover:border-(--module-btn-bg,var(--color-brand)) hover:bg-(--surface-hover,var(--color-gray-100))';

export function AddComponentModal({
  isOpen,
  onClose,
  currency,
  saved,
  onPick,
  onPickSaved,
  onDeleteSaved,
}: AddComponentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a component"
      description="Start from scratch or reuse one you saved. You can change the details afterwards."
      width="max-w-lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Start from scratch
          </h3>
          {ADD_OPTIONS.map((option) => (
            <button
              key={option.title}
              type="button"
              onClick={() => onPick(option)}
              className={optionClass}
            >
              <span className="block text-sm font-medium text-gray-900">{option.title}</span>
              <span className="block text-xs text-gray-500">{option.description}</span>
            </button>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Your saved components
          </h3>
          {saved.length === 0 ? (
            <p className="text-xs text-gray-500">
              Nothing saved yet. Use &ldquo;Save as new&rdquo; in a component&apos;s editor to keep
              it for later.
            </p>
          ) : (
            saved.map((s) => (
              <div key={s.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => onPickSaved(s)}
                  className={`${optionClass} min-w-0 flex-1`}
                >
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {s.component.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {KIND_LABELS[s.component.kind]} ·{' '}
                    {summarize({ ...s.component, id: s.id, enabled: true }, currency)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete saved component ${s.component.name}`}
                  onClick={() => onDeleteSaved(s.id)}
                  className="rounded-lg border border-gray-200 px-2 text-gray-400 transition-colors hover:border-red-300 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </Modal>
  );
}
