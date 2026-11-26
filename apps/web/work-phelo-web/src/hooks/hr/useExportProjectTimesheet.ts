import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProject, useProjectMembers, useProjectSetup } from '@/hooks';
import { extractError } from '@/lib/extractError';
import {
  TimeEntry,
  TimesheetPeriod,
  buildTimesheetWorkbook,
  downloadWorkbook,
  timesheetFileName,
  timesheetRows,
} from '@/lib/projectTimesheet';
import { useToastStore } from '@/store/toast.store';

/** Downloads the chosen people's time over a period as an Excel timesheet, read fresh each time. */
export function useExportProjectTimesheet(projectId: string) {
  const { data: project } = useProject(projectId);
  const { data: members } = useProjectMembers(projectId);
  const setup = useProjectSetup(projectId);
  const toast = useToastStore((s) => s.addToast);

  return useMutation({
    /** Resolves true once a file has been downloaded. */
    mutationFn: async ({
      employeeIds,
      period,
    }: {
      employeeIds: string[];
      period: TimesheetPeriod;
    }) => {
      if (!project || !members) throw new Error('The project is still loading');
      const { data: entries } = await api.get<TimeEntry[]>(
        `/hr/projects/${projectId}/time/entries`,
      );
      const rows = timesheetRows({ entries, members, employeeIds, period });
      if (rows.tasks.length === 0) {
        toast({ message: 'There is no logged time for that selection', type: 'error' });
        return false;
      }
      const workbook = await buildTimesheetWorkbook(
        rows,
        !!setup?.billable && setup.pricing?.type === 'TIMED',
      );
      await downloadWorkbook(workbook, timesheetFileName(project.name, period));
      return true;
    },
    onError: (err) => toast({ message: extractError(err), type: 'error' }),
  });
}
