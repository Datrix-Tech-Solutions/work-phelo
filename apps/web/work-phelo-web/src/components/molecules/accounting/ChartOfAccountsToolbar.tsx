'use client';

import { SearchIcon, Upload } from 'lucide-react';
import { cardClass, inputClass } from '@/lib/utils';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { ActionMenuButton, ActionMenuItem } from '@/components/organisms/shared/ActionMenuButton';
import { Button } from '@/components/atoms/Button';

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

interface ChartOfAccountsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  registerActions: ActionMenuItem[];
  onImport: () => void;
}

/** Search + status filter + "Register Account" menu for the Chart of Accounts page header. */
export function ChartOfAccountsToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  registerActions,
  onImport,
}: ChartOfAccountsToolbarProps) {
  return (
    <div className={cardClass('px-4 py-2')}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={inputClass(undefined, 'pl-9 pr-4 py-2')}
          />
        </div>

        <div className="w-36">
          <SearchSelect
            placeholder="All statuses"
            size="sm"
            options={STATUS_OPTIONS}
            value={status}
            onChange={onStatusChange}
          />
        </div>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          icon={<Upload className="h-3.5 w-3.5" />}
          onClick={onImport}
        >
          Import
        </Button>
        <ActionMenuButton label="Register Account" items={registerActions} />
      </div>
    </div>
  );
}
