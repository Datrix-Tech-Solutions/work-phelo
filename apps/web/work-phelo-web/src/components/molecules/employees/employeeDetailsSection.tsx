import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import type { Employee } from '@/types/hr';

interface Props {
  employee: Employee;
  departments: { id: string; name: string }[];
  allHrEmployees: Employee[];
  currentRoleName?: string | null;
}

export function EmploymentDetailsSection({ employee, allHrEmployees, currentRoleName }: Props) {
  const manager = employee?.managerId
    ? allHrEmployees.find((e) => e.id === employee.managerId)
    : null;

  const managerName = manager ? `${manager.firstName} ${manager.lastName}` : undefined;

  return (
    <SectionCard title="Employment Details">
      <div className="grid grid-cols-4 gap-x-6 gap-y-5">
        <DetailField label="Department" value={employee?.department?.name} />
        <DetailField label="Job Title" value={employee?.jobTitle} />
        <DetailField label="Reporting Manager" value={managerName} />
        <DetailField label="Date of Hire" value={formatDate(employee?.hireDate)} />
        <DetailField label="Employment Type" value={formatType(employee?.employmentType)} />
        <DetailField label="System Role" value={currentRoleName} />
        {employee?.dateOfBirth && (
          <DetailField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
        )}
        {employee?.nationality && <DetailField label="Nationality" value={employee.nationality} />}
        {employee?.address && (
          <DetailField
            label="Address"
            value={[employee.address, employee.city, employee.region].filter(Boolean).join(', ')}
          />
        )}
      </div>
    </SectionCard>
  );
}

// Keep your helper functions here or move to a utils file
function formatDate(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatType(t?: string) {
  if (!t) return undefined;
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
