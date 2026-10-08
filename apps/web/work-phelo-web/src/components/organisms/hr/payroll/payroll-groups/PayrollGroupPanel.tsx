'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import {
  DEFAULT_REMINDER_DAYS,
  FREQUENCY_OPTIONS,
  REMINDER_DAY_OPTIONS,
  checkGroup,
  ordinal,
  type PayFrequency,
  type Payday,
  type PayrollGroup,
  type PayrollGroupInput,
} from '@/lib/payroll-groups';
import { PAYSLIP_TYPES, versionInForce, type SavedConfiguration } from '@/lib/payroll-engine';

const DAY_VALUES = Array.from({ length: 28 }, (_, i) => String(i + 1));

const PAYDAY_OPTIONS = [
  ...DAY_VALUES.map((d) => ({ value: d, label: `${ordinal(Number(d))} of the month` })),
  { value: 'last', label: 'Last day of the month' },
];

const paydayValue = (payday: Payday) => (payday.kind === 'last_day' ? 'last' : String(payday.day));
const toPayday = (value: string): Payday =>
  value === 'last' ? { kind: 'last_day' } : { kind: 'day_of_month', day: Number(value) };

interface PayrollGroupPanelProps {
  /** The group being edited, or null to create one. */
  group: PayrollGroup | null;
  groups: PayrollGroup[];
  configurations: SavedConfiguration[];
  onClose: () => void;
  onSave: (input: PayrollGroupInput) => void;
}

export function PayrollGroupPanel({
  group,
  groups,
  configurations,
  onClose,
  onSave,
}: PayrollGroupPanelProps) {
  const [name, setName] = useState(group?.name ?? '');
  const [frequency, setFrequency] = useState<PayFrequency>(group?.frequency ?? 'monthly');
  const [payday, setPayday] = useState<Payday>(group?.payday ?? { kind: 'last_day' });
  const [configurationId, setConfigurationId] = useState<string | null>(
    group?.configurationId ?? null,
  );
  const [reminderOn, setReminderOn] = useState(group?.reminder.enabled ?? true);
  const [daysBefore, setDaysBefore] = useState(group?.reminder.daysBefore ?? DEFAULT_REMINDER_DAYS);
  const [showProblem, setShowProblem] = useState(false);

  const problem = checkGroup(
    { name, configurationId },
    groups.filter((g) => g.id !== group?.id),
  );
  // A configuration that was removed since the group was saved still has to be replaced.
  const configurationKnown = configurations.some((c) => c.id === configurationId);

  const save = () => {
    if (problem || !configurationKnown) {
      setShowProblem(true);
      return;
    }
    onSave({
      id: group?.id,
      name,
      frequency,
      payday,
      configurationId,
      reminder: { enabled: reminderOn, daysBefore },
    });
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={group ? 'Edit payroll group' : 'New payroll group'}
      description="A group is a set of employees paid the same way, on the same schedule."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{group ? 'Save changes' : 'Create group'}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <Input
          label="Group name"
          placeholder="e.g. Regular employees"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />

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
            value={frequency}
            onChange={(v) => v && setFrequency(v as PayFrequency)}
          />
          <SearchSelect
            label="Payday"
            clearable={false}
            options={PAYDAY_OPTIONS}
            value={paydayValue(payday)}
            onChange={(v) => v && setPayday(toPayday(v))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <SearchSelect
            label="Configuration"
            placeholder="Choose a configuration"
            options={configurations.map((c) => {
              const inForce = versionInForce(c);
              return {
                value: c.id,
                label: c.name,
                sublabel: `${c.payslipType ? PAYSLIP_TYPES[c.payslipType].label : 'No payslip type'} · ${
                  inForce ? `version ${inForce.version} in force` : 'not in force yet'
                }`,
              };
            })}
            value={configurationKnown ? (configurationId ?? '') : ''}
            onChange={(v) => setConfigurationId(v || null)}
          />
          <span className="text-xs text-gray-500">
            {configurations.length === 0
              ? 'No configurations yet. Build and save one under Pay Components first.'
              : "The group is calculated with the version of this configuration that's in force on each payroll run's date."}
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
          <ToggleRow
            label="Payday reminder"
            description="Reminds the people who run payroll ahead of payday."
            enabled={reminderOn}
            onChange={setReminderOn}
          />
          {reminderOn && (
            <SearchSelect
              label="Remind"
              clearable={false}
              options={REMINDER_DAY_OPTIONS.map((d) => ({
                value: String(d),
                label: d === 1 ? '1 day before payday' : `${d} days before payday`,
              }))}
              value={String(daysBefore)}
              onChange={(v) => v && setDaysBefore(Number(v))}
            />
          )}
        </div>

        {showProblem && (problem || !configurationKnown) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {problem ?? 'Choose the configuration this group is calculated with.'}
          </p>
        )}
        {group && configurationId && !configurationKnown && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The configuration this group used no longer exists. Choose another one.
          </p>
        )}
      </div>
    </SidePanel>
  );
}
