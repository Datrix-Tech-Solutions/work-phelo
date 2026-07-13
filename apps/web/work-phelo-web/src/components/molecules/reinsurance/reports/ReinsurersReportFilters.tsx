'use client';

import { useState } from 'react';
import { MultiSelect, MultiSelectOption } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';
import { useReinsurerOptions, useRiskTypeOptions, useCurrencyOptions } from '@/hooks';
import { FACULTATIVE_STATUSES, FacultativeStatus } from '@/types/reinsurance';
import { ReinsurersReportParams } from '@/hooks/reinsurance/useReinsurersReport';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS: MultiSelectOption[] = Array.from({ length: 8 }, (_, i) => {
  const year = String(CURRENT_YEAR - i);
  return { value: year, label: year };
});

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const STATUS_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));

interface ReinsurersReportFiltersProps {
  onGenerate: (params: ReinsurersReportParams) => void;
}

export function ReinsurersReportFilters({ onGenerate }: ReinsurersReportFiltersProps) {
  const [years, setYears] = useState<string[]>([]);
  const [riskTypeId, setRiskTypeId] = useState('');
  const [currency, setCurrency] = useState('');
  const [status, setStatus] = useState('');
  const [reinsurerIds, setReinsurerIds] = useState<string[]>([]);

  const { options: reinsurerOptions } = useReinsurerOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const handleGenerate = () => {
    onGenerate({
      years,
      riskTypeId: riskTypeId || undefined,
      currency: currency || undefined,
      status: (status || undefined) as FacultativeStatus | undefined,
      reinsurerIds: reinsurerIds.length ? reinsurerIds : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
        <MultiSelect
          label="Fiscal Year"
          placeholder="Select year(s)…"
          options={YEAR_OPTIONS}
          value={years}
          onChange={setYears}
          size="sm"
        />

        <SearchSelect
          label="Risk Type"
          placeholder="All risk types"
          options={riskTypeOptions}
          value={riskTypeId}
          onChange={setRiskTypeId}
          size="sm"
        />

        <SearchSelect
          label="Currency"
          placeholder="Base currency"
          options={currencyOptions}
          value={currency}
          onChange={setCurrency}
          size="sm"
        />

        <SearchSelect
          label="Status"
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          size="sm"
        />

        <MultiSelect
          label="Reinsurers"
          placeholder="All reinsurers…"
          options={reinsurerOptions}
          value={reinsurerIds}
          onChange={setReinsurerIds}
          size="sm"
        />
      </div>

      <Button className="w-full" disabled={years.length === 0} onClick={handleGenerate}>
        Generate Report
      </Button>
    </div>
  );
}
