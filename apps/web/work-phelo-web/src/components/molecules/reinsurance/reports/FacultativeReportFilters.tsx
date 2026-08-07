'use client';

import { useState } from 'react';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Button } from '@/components/atoms/Button';
import { useCedantOptions, useRiskTypeOptions, useCurrencyOptions } from '@/hooks';
import { FACULTATIVE_STATUSES, FacultativeStatus } from '@/types/reinsurance';
import { FacultativeReportParams } from '@/hooks/reinsurance/useFacultativeReport';
import { facultativeStatusLabel } from '@/lib/reinsurance/placementStatus';

const STATUS_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({
  value: s,
  label: facultativeStatusLabel(s),
}));

interface FacultativeReportFiltersProps {
  onGenerate: (params: FacultativeReportParams) => void;
}

export function FacultativeReportFilters({ onGenerate }: FacultativeReportFiltersProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskTypeId, setRiskTypeId] = useState('');
  const [currency, setCurrency] = useState('');
  const [status, setStatus] = useState('');
  const [cedantIds, setCedantIds] = useState<string[]>([]);

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const handleGenerate = () => {
    onGenerate({
      startDate,
      endDate,
      riskTypeId: riskTypeId || undefined,
      currency: currency || undefined,
      status: (status || undefined) as FacultativeStatus | undefined,
      cedantIds: cedantIds.length ? cedantIds : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem) flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            label="Period Start"
            placeholder="Start date"
            value={startDate}
            onChange={setStartDate}
            size="sm"
          />
          <DatePicker
            label="Period End"
            placeholder="End date"
            value={endDate}
            minDate={startDate || undefined}
            onChange={setEndDate}
            size="sm"
          />
        </div>

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
          placeholder="Any currency"
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
          label="Cedants"
          placeholder="All cedants…"
          options={cedantOptions}
          value={cedantIds}
          onChange={setCedantIds}
          size="sm"
        />
      </div>

      <Button className="w-full" disabled={!startDate || !endDate} onClick={handleGenerate}>
        Generate Report
      </Button>
    </div>
  );
}
