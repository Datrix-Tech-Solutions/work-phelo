'use client';

import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cardClass } from '@/lib/utils';
import { PAYSLIP_TYPES, latestVersion, type SavedConfiguration } from '@/lib/payroll-engine';

const usedFor = (c: SavedConfiguration) =>
  c.payslipType ? `${PAYSLIP_TYPES[c.payslipType].label} payslips` : 'No payslip type';

interface ConfigurationToolbarProps {
  configurations: SavedConfiguration[];
  current: SavedConfiguration | null;
  dirty: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSave: () => void;
  onDiscard: () => void;
}

export function ConfigurationToolbar({
  configurations,
  current,
  dirty,
  onOpen,
  onNew,
  onSave,
  onDiscard,
}: ConfigurationToolbarProps) {
  return (
    <div className={cardClass('mb-4 flex flex-wrap items-end gap-3 p-3')}>
      <div className="w-full sm:w-72">
        <SearchSelect
          label="Configuration"
          placeholder="New configuration"
          options={configurations.map((c) => ({
            value: c.id,
            label: c.name,
            sublabel: usedFor(c),
          }))}
          value={current?.id ?? ''}
          onChange={(id) => (id ? onOpen(id) : onNew())}
        />
      </div>

      <div className="flex min-h-10 flex-1 flex-wrap items-center gap-2 text-xs text-gray-500">
        {current ? (
          <span>
            {usedFor(current)} · version {latestVersion(current).version}
          </span>
        ) : (
          <span>Not saved yet.</span>
        )}
        {dirty && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
            Unsaved changes
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {dirty && (
          <Button variant="ghost" onClick={onDiscard}>
            Discard changes
          </Button>
        )}
        <Button variant="outline" onClick={onNew}>
          New configuration
        </Button>
        <Button onClick={onSave}>Save configuration</Button>
      </div>
    </div>
  );
}
