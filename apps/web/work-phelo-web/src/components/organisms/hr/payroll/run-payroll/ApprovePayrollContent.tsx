'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Approve Payroll: the runs waiting for approval, each with its payslips and one Approve button.
 * Runs are stored by the next step, so for now there is nothing to approve here.
 */
export function ApprovePayrollContent() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  return (
    <div className="rounded-lg bg-gray-100 px-4 py-6 text-center text-sm text-gray-600">
      <p className="font-medium text-gray-900">Nothing is waiting for approval.</p>
      <p className="mt-1">
        Payroll you run on{' '}
        <Link
          href={`/${tenantSlug}/hr/payroll/manage`}
          className="font-medium underline underline-offset-2"
        >
          Manage Payroll
        </Link>{' '}
        will appear here, with its payslips and one button to approve it. Earlier runs are in
        History.
      </p>
    </div>
  );
}
