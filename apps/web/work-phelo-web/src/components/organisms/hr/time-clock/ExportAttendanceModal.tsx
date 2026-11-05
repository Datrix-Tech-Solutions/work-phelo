'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { exportToCsv } from '@/lib/exportCsv';
import { formatDate, formatTime, formatMinutes } from '@/lib/formatters';
import { fetchAllAttendanceRecords } from '@/hooks/hr/useTimeClock';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  departments: { id: string; name: string }[];
  /** Pre-filled from the filters already set on the records tab. */
  initialFrom?: string;
  initialTo?: string;
  initialDepartment?: string;
}

export function ExportAttendanceModal({
  isOpen,
  onClose,
  departments,
  initialFrom = '',
  initialTo = '',
  initialDepartment = '',
}: Props) {
  const toast = useToast();
  const { data: employees = [] } = useEmployeeOptions();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [departmentId, setDepartmentId] = useState(initialDepartment);
  const [employeeId, setEmployeeId] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFrom(initialFrom);
    setTo(initialTo);
    setDepartmentId(initialDepartment);
    setEmployeeId('');
  }, [isOpen, initialFrom, initialTo, initialDepartment]);

  const employeeChoices = useMemo(
    () =>
      employees
        .filter((e) => !departmentId || e.department?.id === departmentId)
        .map((e) => ({
          value: e.id,
          label: `${e.firstName} ${e.lastName}`,
          sublabel: e.jobTitle,
        })),
    [employees, departmentId],
  );

  const rangeInvalid = !!from && !!to && to < from;

  const handleDepartmentChange = (value: string) => {
    setDepartmentId(value);
    // Drop the employee if they are not in the newly chosen department.
    if (employeeId) {
      const employee = employees.find((e) => e.id === employeeId);
      if (value && employee?.department?.id !== value) setEmployeeId('');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const records = await fetchAllAttendanceRecords({
        fromDate: from,
        toDate: to,
        departmentId,
        employeeId,
      });
      if (records.length === 0) {
        toast.error('No attendance records match these filters.');
        return;
      }
      exportToCsv(
        `clock-in-history-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Employee', 'Date', 'Department', 'Clock In', 'Clock Out', 'Hours', 'Location', 'Flags'],
        records.map((r) => [
          r.employeeName ?? '',
          formatDate(r.date),
          r.department ?? '',
          formatTime(r.clockIn),
          r.clockOut ? formatTime(r.clockOut) : '',
          formatMinutes(r.totalMinutes),
          r.location ?? '',
          r.isOutsideSchedule ? 'Off Schedule' : r.isLate ? 'Late' : '',
        ]),
      );
      toast.success(`Exported ${records.length} record${records.length === 1 ? '' : 's'}.`);
      onClose();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export clock-in history"
      description="Choose what to include. Leave a field empty to include everything."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting || rangeInvalid}>
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <DatePicker placeholder="From date" value={from} onChange={setFrom} />
          <DatePicker placeholder="To date" value={to} onChange={setTo} />
        </div>
        {rangeInvalid && (
          <p className="text-xs text-red-600">The end date must be on or after the start date.</p>
        )}
        <SearchSelect
          label="Department"
          placeholder="All departments"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          value={departmentId}
          onChange={handleDepartmentChange}
          showAllOption
        />
        <SearchSelect
          label="Employee"
          placeholder="All employees"
          options={employeeChoices}
          value={employeeId}
          onChange={setEmployeeId}
          showAllOption
        />
      </div>
    </Modal>
  );
}
