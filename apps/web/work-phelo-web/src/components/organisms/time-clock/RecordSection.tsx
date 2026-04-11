import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { formatDate, formatMinutes } from '@/lib/formatters';
import { Column, DataTable } from '../shared/DataTable';
import type { TimeEntry } from '@/types/timeclock';

interface Props {
  recordsData: { data?: TimeEntry[]; totalPages?: number } | undefined;
  recordsLoading: boolean;
  recordsPage: number;
  onRecordsPageChange: (page: number) => void;
  filterFrom: string;
  filterTo: string;
  filterDept: string;
  filterStatus: string;
  recordsSearch: string;
  onFilterFromChange: (v: string) => void;
  onFilterToChange: (v: string) => void;
  onFilterDeptChange: (v: string) => void;
  onFilterStatusChange: (v: string) => void;
  onRecordsSearchChange: (v: string) => void;
  departments: { id: string; name: string }[];
}

export function RecordsSection({
  recordsData,
  recordsLoading,
  recordsPage,
  onRecordsPageChange,
  filterFrom,
  filterTo,
  filterDept,
  filterStatus,
  onFilterFromChange,
  onFilterToChange,
  onFilterDeptChange,
  onFilterStatusChange,
  onRecordsSearchChange,
  departments,
}: Props) {
  const recordsList = recordsData?.data ?? [];
  const recordsTotalPages = recordsData?.totalPages ?? 1;

  const recordsColumns: Column<TimeEntry>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      render: (r) => <span className="font-medium">{r.employeeName}</span>,
    },
    { key: 'date', label: 'Date', render: (r) => <span>{formatDate(r.date)}</span> },
    { key: 'department', label: 'Department', render: (r) => <span>{r.department ?? '—'}</span> },
    { key: 'clockIn', label: 'Clock In', render: (r) => <span>{formatDate(r.clockIn)}</span> },
    {
      key: 'clockOut',
      label: 'Clock Out',
      render: (r) => <span>{r.clockOut ? formatDate(r.clockOut) : '—'}</span>,
    },
    {
      key: 'totalMinutes',
      label: 'Hours',
      render: (r) => <span className="font-semibold">{formatMinutes(r.totalMinutes)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 shrink-0">
        <DatePicker placeholder="From date" value={filterFrom} onChange={onFilterFromChange} />
        <DatePicker placeholder="To date" value={filterTo} onChange={onFilterToChange} />
        <SearchSelect
          placeholder="All departments"
          options={[
            { value: '', label: 'All departments' },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={filterDept}
          onChange={onFilterDeptChange}
        />
        <SearchSelect
          placeholder="All statuses"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'CLOCKED_IN', label: 'Active' },
            { value: 'CLOCKED_OUT', label: 'Clocked Out' },
            { value: 'ON_BREAK', label: 'On Break' },
            { value: 'ABSENT', label: 'Absent' },
          ]}
          value={filterStatus}
          onChange={onFilterStatusChange}
        />
      </div>

      <DataTable
        columns={recordsColumns}
        data={recordsList}
        isLoading={recordsLoading}
        searchPlaceholder="Search by employee name…"
        onSearch={onRecordsSearchChange}
        currentPage={recordsPage}
        totalPages={recordsTotalPages}
        onPageChange={onRecordsPageChange}
        onExport={() => {
          // CSV export logic can be added here
          console.log('Exporting records...');
        }}
      />
    </div>
  );
}
