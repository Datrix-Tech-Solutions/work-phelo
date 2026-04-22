'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { AppraisalTemplateKpi } from '@/types/hr';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  selfAssessmentWeight: number;
  managerAssessmentWeight: number;
  kpis: Pick<AppraisalTemplateKpi, 'title' | 'weight' | 'maxScore' | 'description'>[];
}

function KpiPreview({
  kpi,
  index,
}: {
  kpi: Pick<AppraisalTemplateKpi, 'title' | 'weight' | 'maxScore' | 'description'>;
  index: number;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <p className="text-sm font-semibold text-gray-900">{kpi.title || 'Untitled KPI'}</p>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
            {kpi.weight}%
          </span>
          <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
            Max: {kpi.maxScore}
          </span>
        </div>
      </div>
      {kpi.description && <p className="text-xs text-gray-500 pl-7">{kpi.description}</p>}
    </div>
  );
}

export function TemplatePreviewModal({
  isOpen,
  onClose,
  templateName,
  selfAssessmentWeight,
  managerAssessmentWeight,
  kpis,
}: TemplatePreviewModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Template Preview"
      description="KPIs and weighting configured for this template."
      width="max-w-xl"
    >
      <div className="mt-4 flex flex-col gap-3">
        <div className="px-4 py-3 rounded-xl bg-brand/5 border border-brand/10">
          <p className="text-xs text-brand/60 font-medium uppercase tracking-wide">Template</p>
          <p className="text-sm font-semibold text-brand mt-0.5">
            {templateName || 'Untitled Template'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">Self Assessment</p>
            <p className="text-lg font-bold text-gray-800 mt-0.5">{selfAssessmentWeight}%</p>
          </div>
          <div className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">Manager Assessment</p>
            <p className="text-lg font-bold text-gray-800 mt-0.5">{managerAssessmentWeight}%</p>
          </div>
        </div>

        {kpis.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No KPIs added yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Key Performance Indicators
            </p>
            {kpis.map((kpi, i) => (
              <KpiPreview key={i} kpi={kpi} index={i} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
