'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useAccountingConfig } from '@/hooks';
import { FISCAL_MONTHS, fiscalYearPreview } from '@/lib/accounting/fiscalYear';

interface GenerateFiscalYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (year: number, startMonth: number) => void;
  isGenerating?: boolean;
}

export function GenerateFiscalYearModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
}: GenerateFiscalYearModalProps) {
  const currentYear = new Date().getFullYear();
  const { data: config } = useAccountingConfig();
  const [year, setYear] = useState(currentYear);
  // Until the user picks one, follow the tenant's configured start month.
  const [monthChoice, setMonthChoice] = useState<number | null>(null);
  const startMonth = monthChoice ?? config?.fiscalYearStartMonth ?? 1;
  const preview = fiscalYearPreview(year, startMonth);
  const yearOptions = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => currentYear + 5 - i).map((y) => ({
        value: String(y),
        label: String(y),
      })),
    [currentYear],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Fiscal Year"
      description="Pick the year and the month the fiscal year starts in. Twelve monthly periods are created from there."
      width="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            isLoading={isGenerating}
            loadingText="Generating…"
            onClick={() => onGenerate(year, startMonth)}
          >
            Generate
          </Button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <SearchSelect
            label="Start Month"
            size="md"
            clearable={false}
            options={FISCAL_MONTHS}
            value={String(startMonth)}
            onChange={(value) => value && setMonthChoice(Number(value))}
          />
          <SearchSelect
            label="Year"
            size="md"
            clearable={false}
            options={yearOptions}
            value={String(year)}
            onChange={(value) => value && setYear(Number(value))}
          />
        </div>

        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-semibold">{preview.name}</span> · {preview.range}
        </p>
      </div>
    </Modal>
  );
}
