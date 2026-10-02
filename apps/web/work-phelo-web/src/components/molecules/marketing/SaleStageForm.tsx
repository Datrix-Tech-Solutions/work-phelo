'use client';

import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ProspectFormSection } from '@/components/molecules/marketing/ProspectFormSection';

export interface SaleStageFields {
  pipelineStageId: string;
}

interface Props {
  values: SaleStageFields;
  onChange: (values: SaleStageFields) => void;
  error?: string;
  pipelineStageOptions?: { value: string; label: string }[];
  isLoading?: boolean;
}

export function SaleStageForm({
  values,
  onChange,
  error,
  pipelineStageOptions = [],
  isLoading,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-8">
      <ProspectFormSection title="Sale Stage">
        <SearchSelect
          label="Pipeline Stage"
          placeholder={isLoading ? 'Loading stages...' : 'Select stage'}
          options={pipelineStageOptions}
          value={values.pipelineStageId}
          onChange={(v) => onChange({ pipelineStageId: v })}
          error={error}
          disabled={isLoading}
        />
      </ProspectFormSection>
    </div>
  );
}
