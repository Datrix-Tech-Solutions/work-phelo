'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';

export function ConfirmDeleteProspectModal({
  name,
  isDeleting,
  onConfirm,
  onCancel,
  title = 'Delete Prospect',
  consequence = 'also removes its contacts, products and interaction history',
  confirmLabel = 'Delete',
  confirmingLabel = 'Deleting…',
  warning = 'This action cannot be undone.',
  verb = 'Deleting',
}: {
  name: string;
  title?: string;
  /** Completes "Deleting <name> …" in the body. */
  consequence?: string;
  confirmLabel?: string;
  confirmingLabel?: string;
  warning?: string;
  /** Opens the body sentence, e.g. "Deleting" or "Retiring". */
  verb?: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{warning}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {verb} <span className="font-semibold text-gray-900">{name}</span> {consequence}.
          Continue?
        </p>
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isDeleting}
            loadingText={confirmingLabel}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
