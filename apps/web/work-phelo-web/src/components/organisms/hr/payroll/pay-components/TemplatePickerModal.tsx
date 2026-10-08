'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { PAYROLL_TEMPLATES, PAYSLIP_TYPES, type PayrollTemplate } from '@/lib/payroll-engine';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (template: PayrollTemplate) => void;
}

const optionClass =
  'rounded-lg border border-gray-200 px-3 py-2 text-left transition-colors hover:border-(--module-btn-bg,var(--color-brand)) hover:bg-(--surface-hover,var(--color-gray-100))';

/** Starting points for a new configuration. Picking one copies its components into the draft. */
export function TemplatePickerModal({ isOpen, onClose, onPick }: TemplatePickerModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start from a template"
      description="Pick one, change what you need, then save it to use for your payroll groups."
      width="max-w-lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="mt-4 flex flex-col gap-2">
        {PAYROLL_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onPick(template)}
            className={optionClass}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">{template.name}</span>
              <span className="text-xs text-gray-500">
                {PAYSLIP_TYPES[template.payslipType].label}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-gray-600">{template.description}</span>
            <ul className="mt-1.5 list-disc pl-4 text-xs text-gray-500">
              {template.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </Modal>
  );
}
