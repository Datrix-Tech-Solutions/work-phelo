import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { extractError } from '@/lib/extractError';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import type { BulkImportRowResult, EmployeeImportRow } from '@/lib/hr/bulkImportTypes';

const CONCURRENCY = 4;

/**
 * Step two of an import with system access. The bulk import only creates employee records, so
 * for every created row the user ticked (and that has an email) this queues a grant request.
 * Each employee gets a fixed Idempotency-Key, so re-running after a lost response never makes a
 * second invite. A failed grant leaves the employee in place and is reported on that row.
 */
export function useGrantImportedAccess() {
  const queryClient = useQueryClient();
  const canGrantAccess = usePermission(Permission.INVITE_USER);

  const grantAccess = useCallback(
    async (
      rows: EmployeeImportRow[],
      results: BulkImportRowResult[],
    ): Promise<BulkImportRowResult[]> => {
      if (!canGrantAccess) return results;

      const rowByNumber = new Map(rows.map((r) => [r.rowNumber, r]));
      const outcomes = new Map<number, Pick<BulkImportRowResult, 'access' | 'accessMessage'>>();

      const queue = results.filter((result) => {
        const row = rowByNumber.get(result.rowNumber);
        return result.status === 'created' && result.id && row?.grantAccess && row.email;
      });

      const worker = async () => {
        for (let result = queue.shift(); result; result = queue.shift()) {
          const row = rowByNumber.get(result.rowNumber)!;
          try {
            await api.post(
              `/hr/employees/${result.id}/system-access/grant`,
              { email: row.email },
              { headers: { 'Idempotency-Key': `bulk-grant:${result.id}` } },
            );
            outcomes.set(result.rowNumber, { access: 'queued' });
          } catch (error) {
            outcomes.set(result.rowNumber, {
              access: 'failed',
              accessMessage: extractError(error, 'Could not queue the invite'),
            });
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      if (outcomes.size > 0) queryClient.invalidateQueries({ queryKey: ['employees'] });
      return results.map((r) => ({ ...r, ...outcomes.get(r.rowNumber) }));
    },
    [canGrantAccess, queryClient],
  );

  return { canGrantAccess, grantAccess };
}
