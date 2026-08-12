'use client';

import { useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { cardClass, inputClass } from '@/lib/utils';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { ActionMenuButton } from '@/components/organisms/shared/ActionMenuButton';
import { ChartOfAccountsTree } from '@/components/organisms/accounting/ChartOfAccountsTree';
import { AddClassificationPanel } from '@/components/organisms/accounting/panels/AddClassificationPanel';
import { AddParentAccountPanel } from '@/components/organisms/accounting/panels/AddParentAccountPanel';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { GLAccountDetail } from '@/components/organisms/accounting/GLAccountDetail';
import { GLAccount } from '@/types/accounting';

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

type OpenPanel = 'classification' | 'parent-account' | 'leaf-account' | null;

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [selectedAccount, setSelectedAccount] = useState<GLAccount | null>(null);

  return (
    <>
      <TwoPanelShell
        header={
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-900">Chart of Accounts</h2>

            <div className={cardClass('px-4 py-2')}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-52 max-w-sm">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search accounts…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={inputClass(undefined, 'pl-9 pr-4 py-2')}
                  />
                </div>

                <div className="w-36">
                  <SearchSelect
                    placeholder="All statuses"
                    size="sm"
                    options={STATUS_OPTIONS}
                    value={status}
                    onChange={setStatus}
                  />
                </div>

                <div className="flex-1" />

                <ActionMenuButton
                  label="Register Account"
                  items={[
                    {
                      label: 'Classification',
                      description: 'e.g. Current Assets',
                      onClick: () => setOpenPanel('classification'),
                    },
                    {
                      label: 'Parent Account',
                      description: 'e.g. Bank Accounts',
                      onClick: () => setOpenPanel('parent-account'),
                    },
                    {
                      label: 'Leaf Account',
                      description: 'e.g. Ecobank',
                      onClick: () => setOpenPanel('leaf-account'),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        }
        leftPanel={({ collapsed, expand }) => (
          <ChartOfAccountsTree
            collapsed={collapsed}
            onExpand={expand}
            selectedAccountId={selectedAccount?.id}
            onSelectAccount={setSelectedAccount}
          />
        )}
        rightPanel={
          selectedAccount ? (
            <GLAccountDetail account={selectedAccount} />
          ) : (
            <p className="text-sm text-gray-400">Select a leaf account to view its details</p>
          )
        }
      />

      <AddClassificationPanel
        isOpen={openPanel === 'classification'}
        onClose={() => setOpenPanel(null)}
      />
      <AddParentAccountPanel
        isOpen={openPanel === 'parent-account'}
        onClose={() => setOpenPanel(null)}
      />
      <AddLeafAccountPanel
        isOpen={openPanel === 'leaf-account'}
        onClose={() => setOpenPanel(null)}
      />
    </>
  );
}
