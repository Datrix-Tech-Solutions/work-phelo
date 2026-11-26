'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { Modal } from '@/components/organisms/shared/Modal';
import { useProjectMembers } from '@/hooks';
import { useExportProjectTimesheet } from '@/hooks/hr/useExportProjectTimesheet';
import { useProjectTime } from '@/hooks/hr/useProjectTime';

interface Props {
  projectId: string;
  /** Starts with only this person selected, instead of everyone. */
  employeeId?: string;
}

/** The dates and people for a timesheet, asked for before it is downloaded. */
function ExportTimesheetModal({ projectId, employeeId, onClose }: Props & { onClose: () => void }) {
  const { data: members = [] } = useProjectMembers(projectId);
  const { people } = useProjectTime(projectId);
  const exportTimesheet = useExportProjectTimesheet(projectId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Null until changed, so everyone stays selected while the list is still loading.
  const [picked, setPicked] = useState<string[] | null>(employeeId ? [employeeId] : null);

  // Every member, plus anyone with logged time who is no longer one.
  const options = [
    ...members.map((m) => ({
      value: m.employeeId,
      label: m.name,
      sublabel: m.department ?? undefined,
    })),
    ...people
      .filter((p) => !members.some((m) => m.employeeId === p.personId))
      .map((p) => ({ value: p.personId, label: p.personName, sublabel: 'Not on the team' })),
  ];
  const selected = picked ?? options.map((o) => o.value);
  const backwards = !!from && !!to && from > to;

  const handleExport = () =>
    exportTimesheet.mutate(
      { employeeIds: selected, period: { from, to } },
      { onSuccess: (downloaded) => downloaded && onClose() },
    );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Export Timesheet"
      description="Leave the dates empty to export all logged time."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selected.length === 0 || backwards}
            isLoading={exportTimesheet.isPending}
            loadingText="Exporting…"
          >
            Export
          </Button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker label="From" value={from} onChange={setFrom} placeholder="Start" />
          <DatePicker
            label="To"
            value={to}
            onChange={setTo}
            placeholder="Today"
            error={backwards ? 'Ends before it starts' : undefined}
          />
        </div>
        <MultiSelect
          label={`Employees (${selected.length} of ${options.length})`}
          placeholder="Select employees"
          options={options}
          value={selected}
          onChange={setPicked}
          error={selected.length === 0 ? 'Select at least one employee' : undefined}
        />
      </div>
    </Modal>
  );
}

export function ExportTimesheetButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        Export Timesheet
      </Button>
      {open && <ExportTimesheetModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
