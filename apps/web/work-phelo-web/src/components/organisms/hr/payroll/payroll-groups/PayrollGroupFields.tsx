'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { TypeChip } from '@/components/atoms/TypeChip';
import {
  FREQUENCY_LABELS,
  FREQUENCY_OPTIONS,
  REMINDER_DAY_OPTIONS,
  describePayday,
  ordinal,
  type GroupSettings,
  type PayFrequency,
  type Payday,
  type PayrollGroup,
} from '@/lib/payroll-groups';
import { COMPENSATION_PAYSLIP_TYPE, type PayslipTypeKey } from '@/lib/payroll-engine';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import type { Employee, EmploymentType } from '@/types/hr';

const DAY_VALUES = Array.from({ length: 28 }, (_, i) => String(i + 1));

const PAYDAY_OPTIONS = [
  ...DAY_VALUES.map((d) => ({ value: d, label: `${ordinal(Number(d))} of the month` })),
  { value: 'last', label: 'Last day of the month' },
];

const paydayValue = (payday: Payday) => (payday.kind === 'last_day' ? 'last' : String(payday.day));
const toPayday = (value: string): Payday =>
  value === 'last' ? { kind: 'last_day' } : { kind: 'day_of_month', day: Number(value) };

const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

/** '' is nothing chosen yet; 'all' is the explicit "All ..." choice, which doesn't narrow. */
const narrows = (filter: string) => filter !== '' && filter !== 'all';

/** Only employees paid the way the payslip type pays (Salary, Commission or both) can join. */
export function eligibleEmployees(employees: Employee[], payslipType: PayslipTypeKey | null) {
  if (!payslipType) return [];
  return employees.filter(
    (e) =>
      (e.employmentStatus === 'ACTIVE' || e.employmentStatus === 'PROBATION') &&
      COMPENSATION_PAYSLIP_TYPE[e.compensationType ?? 'SALARY'] === payslipType,
  );
}

/** A bordered block whose body folds away behind a header that says what is inside. */
function CollapsibleSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <section className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-bold text-gray-900">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
          <span className="truncate">{summary}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`}
          />
        </span>
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-2 px-3 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}

interface PayrollGroupFieldsProps {
  settings: GroupSettings;
  onChange: (settings: GroupSettings) => void;
  /** Decides who can join; with none chosen yet nobody can. */
  payslipType: PayslipTypeKey | null;
  /** Every employee, to pick the group's members from. */
  employees: Employee[];
  groups: PayrollGroup[];
  /** The group being edited, so its own members aren't shown as moving. */
  groupId?: string;
}

/** Pay frequency, payday and the payday reminder of a payroll group. */
export function PayrollGroupScheduleFields({
  settings,
  onChange,
}: {
  settings: GroupSettings;
  onChange: (settings: GroupSettings) => void;
}) {
  const patch = (next: Partial<GroupSettings>) => onChange({ ...settings, ...next });

  return (
    <>
      <div className="grid grid-cols-1 gap-(--field-stack-gap,0.75rem) sm:grid-cols-2">
        <SearchSelect
          label="Pay frequency"
          clearable={false}
          options={FREQUENCY_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            disabled: !o.available,
            tag: o.available ? undefined : 'Not available yet',
          }))}
          value={settings.frequency}
          onChange={(v) => v && patch({ frequency: v as PayFrequency })}
        />
        <SearchSelect
          label="Payday"
          clearable={false}
          options={PAYDAY_OPTIONS}
          value={paydayValue(settings.payday)}
          onChange={(v) => v && patch({ payday: toPayday(v) })}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3">
        <ToggleRow
          label="Payday reminder"
          description="Reminds the people who run payroll ahead of payday."
          enabled={settings.reminder.enabled}
          onChange={(enabled) => patch({ reminder: { ...settings.reminder, enabled } })}
        />
        {settings.reminder.enabled && (
          <SearchSelect
            label="Remind"
            clearable={false}
            options={REMINDER_DAY_OPTIONS.map((d) => ({
              value: String(d),
              label: d === 1 ? '1 day before payday' : `${d} days before payday`,
            }))}
            value={String(settings.reminder.daysBefore)}
            onChange={(v) =>
              v && patch({ reminder: { ...settings.reminder, daysBefore: Number(v) } })
            }
          />
        )}
      </div>
    </>
  );
}

/** Picks a payroll group's members by department, employee type or one by one. */
export function PayrollGroupMemberFields({
  settings,
  onChange,
  payslipType,
  employees,
  groups,
  groupId,
}: PayrollGroupFieldsProps) {
  const patch = (next: Partial<GroupSettings>) => onChange({ ...settings, ...next });
  const groupName = (id: string | null | undefined) => groups.find((g) => g.id === id)?.name;

  const { data: departments = [] } = useDepartmentOptions();
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('');

  const eligible = eligibleEmployees(employees, payslipType);
  const matching = (dept: string, type: string) =>
    eligible.filter(
      (e) =>
        (!narrows(dept) || e.departmentId === dept) &&
        (!narrows(type) || e.employmentType === type),
    );
  // Choosing a department or type picks everyone it covers; the list below then adjusts it.
  const pick = (dept: string, type: string) => {
    setDepartment(dept);
    setEmploymentType(type);
    if (dept === '' && type === '') return;
    const picked = matching(dept, type).map((e) => e.id);
    patch({ memberIds: [...new Set([...settings.memberIds, ...picked])] });
  };
  // Members who stop fitting after the payslip type changes drop out of the list.
  const validMembers = settings.memberIds.filter((id) => eligible.some((e) => e.id === id));

  return (
    <>
      <div className="grid grid-cols-1 gap-(--field-stack-gap,0.75rem) sm:grid-cols-2">
        <SearchSelect
          label="Department"
          placeholder="Select a department"
          options={[
            { value: 'all', label: 'All departments' },
            ...departments
              .filter((d) => eligible.some((e) => e.departmentId === d.id))
              .map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={department}
          onChange={(v) => pick(v, employmentType)}
        />
        <SearchSelect
          label="Employee type"
          placeholder="Select a type"
          options={[{ value: 'all', label: 'All types' }, ...EMPLOYMENT_TYPE_OPTIONS]}
          value={employmentType}
          onChange={(v) => pick(department, v)}
        />
      </div>
      <MultiSelect
        placeholder={payslipType ? 'Add employees to this group' : 'Choose a configuration first'}
        hideChips
        options={eligible
          .filter(
            (e) =>
              validMembers.includes(e.id) ||
              ((!narrows(department) || e.departmentId === department) &&
                (!narrows(employmentType) || e.employmentType === employmentType)),
          )
          .map((e) => {
            const other = e.payrollGroupId && e.payrollGroupId !== groupId;
            return {
              value: e.id,
              label: `${e.firstName} ${e.lastName}`,
              sublabel: other
                ? `Now in ${groupName(e.payrollGroupId) ?? 'another group'}`
                : e.jobTitle,
            };
          })}
        value={validMembers}
        onChange={(memberIds) => patch({ memberIds })}
      />
      {validMembers.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
          {validMembers.map((id) => {
            const employee = employees.find((e) => e.id === id);
            if (!employee) return null;
            const moving = employee.payrollGroupId && employee.payrollGroupId !== groupId;
            return (
              <li key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-gray-900">
                    {employee.firstName} {employee.lastName}
                  </span>
                  <span className="truncate text-xs text-gray-500">{employee.jobTitle}</span>
                </span>
                <span className="flex items-center gap-2">
                  {moving && (
                    <TypeChip
                      label={`From ${groupName(employee.payrollGroupId) ?? 'another group'}`}
                      color="amber"
                    />
                  )}
                  <button
                    type="button"
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                    onClick={() => patch({ memberIds: validMembers.filter((m) => m !== id) })}
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * The schedule, members and payday reminder of a payroll group. Shared by the group panel and
 * the save pop-up of a new configuration, which creates its group too.
 */
export function PayrollGroupFields(props: PayrollGroupFieldsProps) {
  const { settings, payslipType, employees } = props;
  const memberCount = settings.memberIds.filter((id) =>
    eligibleEmployees(employees, payslipType).some((e) => e.id === id),
  ).length;

  return (
    <>
      <CollapsibleSection
        title="Payment schedule"
        summary={`${FREQUENCY_LABELS[settings.frequency]} · ${describePayday(settings.payday)}`}
      >
        <PayrollGroupScheduleFields settings={settings} onChange={props.onChange} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Employees"
        summary={memberCount === 0 ? 'None selected' : `${memberCount} selected`}
      >
        <PayrollGroupMemberFields {...props} />
      </CollapsibleSection>
    </>
  );
}
