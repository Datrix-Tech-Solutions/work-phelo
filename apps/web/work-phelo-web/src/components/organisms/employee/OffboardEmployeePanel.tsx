'use client';

import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import {
  useOffboardingRecord,
  useInitiateOffboard,
  useUpdateOffboardChecklist,
  useCompleteOffboard,
} from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { InitiateOffboardDto, OffboardReason } from '@/types/hr';

interface OffboardEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
}

/* ── Checklist item labels ── */
const CHECKLIST_ITEMS: { field: ChecklistItem; label: string }[] = [
  { field: 'assetReturn', label: 'Assets returned' },
  { field: 'hrClearance', label: 'HR clearance' },
  { field: 'financeClearance', label: 'Finance clearance' },
  { field: 'reportingClearance', label: 'Reporting clearance' },
];

type ChecklistItem = 'assetReturn' | 'hrClearance' | 'financeClearance' | 'reportingClearance';

const REASONS: { value: OffboardReason; label: string }[] = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'CONTRACT_ENDED', label: 'Contract ended' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'REDUNDANCY', label: 'Redundancy' },
  { value: 'OTHER', label: 'Other' },
];

/* ── Phase 1: Initiation form ── */
interface InitiateFormValues {
  reason: OffboardReason | '';
  otherReason: string;
  lastWorkingDate: string;
  exitNotes: string;
}

function InitiationForm({
  employeeId,
  onInitiated,
}: {
  employeeId: string;
  onInitiated: () => void;
}) {
  const toast = useToast();
  const { mutate: initiate, isPending } = useInitiateOffboard(employeeId);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<InitiateFormValues>({
    defaultValues: { reason: '', otherReason: '', lastWorkingDate: '', exitNotes: '' },
  });

  const reason = useWatch({ control, name: 'reason' });
  const lastWorkingDate = useWatch({ control, name: 'lastWorkingDate' });

  const onSubmit = (values: InitiateFormValues) => {
    if (!values.reason) return;
    const dto: InitiateOffboardDto = {
      reason: values.reason as OffboardReason,
      otherReason: values.reason === 'OTHER' ? values.otherReason : undefined,
      lastWorkingDate: values.lastWorkingDate,
      exitNotes: values.exitNotes || undefined,
    };
    initiate(dto, {
      onSuccess: () => {
        toast.success('Offboarding initiated');
        onInitiated();
      },
      onError: (err) => toast.error(extractError(err, 'Failed to initiate offboarding')),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Reason */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Reason for leaving</label>
        <select
          {...register('reason', { required: 'Reason is required' })}
          className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand"
        >
          <option value="">Select reason</option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
      </div>

      {/* Other reason — only when OTHER is selected */}
      {reason === 'OTHER' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Please specify</label>
          <input
            {...register('otherReason', { required: 'Please specify the reason' })}
            placeholder="Describe the reason…"
            className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand"
          />
          {errors.otherReason && (
            <p className="text-xs text-red-500">{errors.otherReason.message}</p>
          )}
        </div>
      )}

      {/* Last working date */}
      <DatePicker
        label="Last Working Day"
        value={lastWorkingDate}
        onChange={(v) => setValue('lastWorkingDate', v)}
        error={errors.lastWorkingDate?.message}
      />

      {/* Exit notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">
          Exit Interview Notes
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          {...register('exitNotes')}
          rows={4}
          placeholder="Add any notes from the exit interview…"
          className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none"
        />
      </div>

      <Button type="submit" isLoading={isPending} loadingText="Saving…">
        Save & Continue to Checklist
      </Button>
    </form>
  );
}

/* ── Phase 2: Clearance checklist + completion ── */
function ChecklistForm({
  employeeId,
  onCompleted,
  onClose,
}: {
  employeeId: string;
  onCompleted: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: record, isLoading } = useOffboardingRecord(employeeId);
  const { mutate: updateItem, isPending: isUpdating } = useUpdateOffboardChecklist(employeeId);
  const { mutate: complete, isPending: isCompleting } = useCompleteOffboard(employeeId);

  if (isLoading || !record) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-sm text-gray-400">Loading checklist…</p>
      </div>
    );
  }

  const allDone =
    record.assetReturnDone &&
    record.hrClearanceDone &&
    record.financeClearanceDone &&
    record.managerApprovalDone;

  const checklistState: Record<ChecklistItem, boolean> = {
    assetReturn: record.assetReturnDone ?? false,
    hrClearance: record.hrClearanceDone ?? false,
    financeClearance: record.financeClearanceDone ?? false,
    reportingClearance: record.managerApprovalDone ?? false,
  };

  const handleToggle = (item: ChecklistItem, done: boolean) => {
    updateItem(
      { item, done },
      {
        onError: (err) => toast.error(extractError(err, 'Failed to update checklist')),
      },
    );
  };

  const handleComplete = () => {
    complete(undefined, {
      onSuccess: () => {
        toast.success('Employee offboarded successfully');
        onCompleted();
      },
      onError: (err) => toast.error(extractError(err, 'Failed to complete offboarding')),
    });
  };

  const REASON_LABELS: Record<string, string> = {
    RESIGNATION: 'Resignation',
    TERMINATION: 'Termination',
    CONTRACT_ENDED: 'Contract ended',
    RETIREMENT: 'Retirement',
    REDUNDANCY: 'Redundancy',
    OTHER: 'Other',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="bg-gray-50 rounded-card px-4 py-3 flex flex-col gap-1">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Summary</p>
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Reason:</span>{' '}
          {REASON_LABELS[record.reason] ?? record.reason}
          {record.otherReason ? ` — ${record.otherReason}` : ''}
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Last working day:</span>{' '}
          {new Date(record.lastWorkingDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Checklist */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Clearance Checklist
        </p>
        {CHECKLIST_ITEMS.map(({ field, label }) => (
          <label key={field} className="flex items-center gap-3 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={checklistState[field]}
              onChange={(e) => handleToggle(field, e.target.checked)}
              disabled={isUpdating}
              className="w-4 h-4 rounded accent-brand shrink-0 cursor-pointer"
            />
            <span
              className={`text-sm ${checklistState[field] ? 'line-through text-gray-400' : 'text-gray-700'}`}
            >
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <Button
          onClick={handleComplete}
          isLoading={isCompleting}
          loadingText="Completing…"
          disabled={!allDone}
        >
          Complete Offboarding
        </Button>
        {!allDone && (
          <p className="text-xs text-center text-gray-400">
            All four clearance items must be ticked to complete
          </p>
        )}
        <Button variant="outline" onClick={onClose}>
          Save as Draft
        </Button>
      </div>
    </div>
  );
}

/* ── Main panel ── */
export function OffboardEmployeePanel({
  isOpen,
  onClose,
  employeeId,
  employeeName,
}: OffboardEmployeePanelProps) {
  const { data: existingRecord } = useOffboardingRecord(employeeId);

  // Derive phase directly from server state — no extra useState/useEffect needed.
  // After InitiationForm succeeds it invalidates the query, existingRecord populates,
  // and the panel automatically switches to the checklist view.
  const phase = existingRecord ? 'checklist' : 'initiate';

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Offboard Employee"
      description={`Processing departure for ${employeeName}`}
      width="w-[520px]"
    >
      {/* Phase indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(['initiate', 'checklist'] as const).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-gray-200" />}
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold
              ${phase === p ? 'bg-brand text-white' : existingRecord && p === 'checklist' ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-400'}`}
            >
              <span>{i + 1}</span>
              <span>{p === 'initiate' ? 'Details' : 'Clearance'}</span>
            </div>
          </div>
        ))}
      </div>

      {phase === 'initiate' ? (
        <InitiationForm employeeId={employeeId} onInitiated={() => {}} />
      ) : (
        <ChecklistForm employeeId={employeeId} onCompleted={onClose} onClose={onClose} />
      )}
    </SidePanel>
  );
}
