import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee } from '@/types/hr';

interface Props {
  employee: Employee;
}

export function BankingComplianceSection({ employee }: Props) {
  const hasSalary = employee.basicSalary !== undefined && employee.basicSalary !== null;
  const hasBankDetails = employee.bankName || employee.bankAccountNumber || employee.bankBranch;
  const hasCompliance = employee.ssnit || employee.tinNumber;

  if (!hasSalary && !hasBankDetails && !hasCompliance) return null;

  return (
    <SectionCard title="Banking & Compliance">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        {hasSalary && (
          <DetailField
            label="Basic Salary"
            value={`GHS ${Number(employee.basicSalary).toLocaleString('en-GH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          />
        )}
        {employee.bankName && <DetailField label="Bank Name" value={employee.bankName} />}
        {employee.bankAccountNumber && (
          <DetailField label="Account Number" value={employee.bankAccountNumber} />
        )}
        {employee.bankBranch && <DetailField label="Bank Branch" value={employee.bankBranch} />}
        {employee.ssnit && <DetailField label="SSNIT Number" value={employee.ssnit} />}
        {employee.tinNumber && <DetailField label="TIN Number" value={employee.tinNumber} />}
      </div>
    </SectionCard>
  );
}
