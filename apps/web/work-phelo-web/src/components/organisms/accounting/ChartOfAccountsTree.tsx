'use client';

import { useMemo, useState } from 'react';
import { File, FileText, Folder, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AllAccountsTreeRow } from '@/components/molecules/accounting/AllAccountsTreeRow';
import { ExpandableTreeRow } from '@/components/molecules/accounting/ExpandableTreeRow';
import { SelectableTreeRow } from '@/components/molecules/accounting/SelectableTreeRow';
import { getSelectedRowTint } from '@/lib/accounting/treeRowColor';
import {
  AccountClassification,
  AccountGroup,
  GLAccount,
  GLAccountCategory,
} from '@/types/accounting';

export const CATEGORIES: {
  value: GLAccountCategory;
  label: string;
  code: string;
  color: string;
}[] = [
  { value: 'ASSET', label: 'Asset', code: '1000', color: 'text-blue-500' },
  { value: 'LIABILITY', label: 'Liability', code: '2000', color: 'text-red-500' },
  { value: 'EQUITY', label: 'Equity', code: '3000', color: 'text-purple-500' },
  { value: 'REVENUE', label: 'Revenue', code: '4000', color: 'text-green-500' },
  { value: 'EXPENSE', label: 'Expense', code: '5000', color: 'text-orange-500' },
];

/** What the right-hand panel is currently showing — a single account, or a scope
 *  (everything, a type, a classification, or a group) whose leaf accounts get listed. */
export type AccountScope =
  | { kind: 'all' }
  | { kind: 'category'; category: GLAccountCategory }
  | { kind: 'classification'; classification: AccountClassification }
  | { kind: 'group'; group: AccountGroup }
  | { kind: 'account'; account: GLAccount };

// Keys into the single flat `openKeys` set that drives expand/collapse at every level. One
// flat set (rather than per-level state) is what lets a selection collapse siblings at every
// level in one move — see `pathKeysForScope` below.
const typeKey = (category: GLAccountCategory) => `type:${category}`;
const classificationKey = (id: string) => `classification:${id}`;
const groupKey = (id: string) => `group:${id}`;

/** The ancestor-chain keys that must be open for the given scope to be visible. Selecting a
 *  scope replaces `openKeys` with exactly this set, so every branch not on the path collapses
 *  — at every level, in one move. */
function pathKeysForScope(scope: AccountScope, groups: AccountGroup[]): Set<string> {
  switch (scope.kind) {
    case 'all':
      return new Set();
    case 'category':
      return new Set([typeKey(scope.category)]);
    case 'classification':
      return new Set([
        typeKey(scope.classification.category),
        classificationKey(scope.classification.id),
      ]);
    case 'group':
      return new Set([
        typeKey(scope.group.classification.category),
        classificationKey(scope.group.classificationId),
        groupKey(scope.group.id),
      ]);
    case 'account': {
      const group = scope.account.accountGroupId
        ? groups.find((g) => g.id === scope.account.accountGroupId)
        : undefined;
      if (!group) return new Set([typeKey(scope.account.category)]);
      return new Set([
        typeKey(group.classification.category),
        classificationKey(group.classificationId),
        groupKey(group.id),
      ]);
    }
  }
}

interface GroupNodeProps {
  color: string;
  group: AccountGroup;
  glAccounts: GLAccount[];
  selectedGroupId?: string;
  selectedAccountId?: string;
  openKeys: Set<string>;
  onToggleOpen: (key: string) => void;
  onSelectScope: (scope: AccountScope) => void;
}

function GroupNode({
  color,
  group,
  glAccounts,
  selectedGroupId,
  selectedAccountId,
  openKeys,
  onToggleOpen,
  onSelectScope,
}: GroupNodeProps) {
  const key = groupKey(group.id);
  const open = openKeys.has(key);
  const hasAccounts = glAccounts.length > 0;
  const isSelected = group.id === selectedGroupId;

  if (!hasAccounts) {
    return (
      <SelectableTreeRow
        onSelect={() => onSelectScope({ kind: 'group', group })}
        isSelected={isSelected}
        color={color}
        code={group.code}
        label={group.name}
        icon={File}
      />
    );
  }

  return (
    <div>
      <ExpandableTreeRow
        open={open}
        onToggle={() => onToggleOpen(key)}
        onSelect={() => onSelectScope({ kind: 'group', group })}
        isSelected={isSelected}
        color={color}
        code={group.code}
        label={group.name}
        count={glAccounts.length}
      />

      {open && (
        <div className="ml-6 border-l border-gray-100 pl-3 flex flex-col">
          {glAccounts.map((account) => (
            <SelectableTreeRow
              key={account.id}
              onSelect={() => onSelectScope({ kind: 'account', account })}
              isSelected={account.id === selectedAccountId}
              color={color}
              code={account.code}
              label={account.name}
              icon={FileText}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ClassificationNodeProps {
  color: string;
  classification: AccountClassification;
  groups: AccountGroup[];
  glAccounts: GLAccount[];
  selectedClassificationId?: string;
  selectedGroupId?: string;
  selectedAccountId?: string;
  openKeys: Set<string>;
  onToggleOpen: (key: string) => void;
  onSelectScope: (scope: AccountScope) => void;
}

function ClassificationNode({
  color,
  classification,
  groups,
  glAccounts,
  selectedClassificationId,
  selectedGroupId,
  selectedAccountId,
  openKeys,
  onToggleOpen,
  onSelectScope,
}: ClassificationNodeProps) {
  const key = classificationKey(classification.id);
  const open = openKeys.has(key);
  const hasGroups = groups.length > 0;
  const isSelected = classification.id === selectedClassificationId;

  if (!hasGroups) {
    return (
      <SelectableTreeRow
        onSelect={() => onSelectScope({ kind: 'classification', classification })}
        isSelected={isSelected}
        color={color}
        code={classification.code}
        label={classification.name}
        indent
        icon={File}
      />
    );
  }

  return (
    <div>
      <ExpandableTreeRow
        open={open}
        onToggle={() => onToggleOpen(key)}
        onSelect={() => onSelectScope({ kind: 'classification', classification })}
        isSelected={isSelected}
        color={color}
        code={classification.code}
        label={classification.name}
        count={groups.length}
      />

      {open && (
        <div className="ml-6 border-l border-gray-100 pl-3 flex flex-col">
          {groups.map((group) => (
            <GroupNode
              key={group.id}
              color={color}
              group={group}
              glAccounts={glAccounts.filter((a) => a.accountGroupId === group.id)}
              selectedGroupId={selectedGroupId}
              selectedAccountId={selectedAccountId}
              openKeys={openKeys}
              onToggleOpen={onToggleOpen}
              onSelectScope={onSelectScope}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TypeNodeProps {
  label: string;
  code: string;
  color: string;
  category: GLAccountCategory;
  classifications: AccountClassification[];
  groups: AccountGroup[];
  glAccounts: GLAccount[];
  unclassifiedAccounts: GLAccount[];
  selectedCategory?: GLAccountCategory;
  selectedClassificationId?: string;
  selectedGroupId?: string;
  selectedAccountId?: string;
  openKeys: Set<string>;
  onToggleOpen: (key: string) => void;
  onSelectScope: (scope: AccountScope) => void;
}

function TypeNode({
  label,
  code,
  color,
  category,
  classifications,
  groups,
  glAccounts,
  unclassifiedAccounts,
  selectedCategory,
  selectedClassificationId,
  selectedGroupId,
  selectedAccountId,
  openKeys,
  onToggleOpen,
  onSelectScope,
}: TypeNodeProps) {
  const key = typeKey(category);
  const open = openKeys.has(key);

  return (
    <div>
      <ExpandableTreeRow
        open={open}
        onToggle={() => onToggleOpen(key)}
        onSelect={() => onSelectScope({ kind: 'category', category })}
        isSelected={category === selectedCategory}
        color={color}
        code={code}
        label={label}
        count={classifications.length + (unclassifiedAccounts.length > 0 ? 1 : 0)}
        size="md"
      />

      {open && (
        <div className="ml-6 border-l border-gray-100 pl-3 flex flex-col">
          {classifications.length > 0 &&
            classifications.map((classification) => (
              <ClassificationNode
                key={classification.id}
                color={color}
                classification={classification}
                groups={groups.filter((g) => g.classificationId === classification.id)}
                glAccounts={glAccounts}
                selectedClassificationId={selectedClassificationId}
                selectedGroupId={selectedGroupId}
                selectedAccountId={selectedAccountId}
                openKeys={openKeys}
                onToggleOpen={onToggleOpen}
                onSelectScope={onSelectScope}
              />
            ))}
          {unclassifiedAccounts.length > 0 && (
            <div className="mt-1 rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800">Unclassified accounts</p>
              <p className="mt-0.5 text-xs text-amber-700">
                Assign these accounts to a standard group when their hierarchy is ready.
              </p>
              <div className="mt-2 flex flex-col">
                {unclassifiedAccounts.map((account) => {
                  const isSelected = account.id === selectedAccountId;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => onSelectScope({ kind: 'account', account })}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-amber-100',
                        isSelected && getSelectedRowTint(color),
                      )}
                    >
                      <FileText className={cn('h-4 w-4 shrink-0', color)} />
                      <span className="shrink-0 text-xs font-semibold text-gray-400">
                        {account.code}
                      </span>
                      <span className="truncate">{account.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {classifications.length === 0 && unclassifiedAccounts.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">No accounts</p>
          )}
        </div>
      )}
    </div>
  );
}

interface ChartOfAccountsTreeProps {
  // collapse the tree to a narrow rail.
  collapsed?: boolean;
  onExpand?: () => void;
  classifications: AccountClassification[];
  groups: AccountGroup[];
  glAccounts: GLAccount[];
  isLoading?: boolean;
  hasAccountFilter?: boolean;
  scope: AccountScope;
  onSelectScope: (scope: AccountScope) => void;
}

export function ChartOfAccountsTree({
  collapsed = false,
  onExpand,
  classifications,
  groups,
  glAccounts,
  isLoading = false,
  hasAccountFilter = false,
  scope,
  onSelectScope,
}: ChartOfAccountsTreeProps) {
  const visibleGroups = useMemo(
    () =>
      hasAccountFilter
        ? groups.filter((group) =>
            glAccounts.some((account) => account.accountGroupId === group.id),
          )
        : groups,
    [glAccounts, groups, hasAccountFilter],
  );
  const visibleClassifications = useMemo(
    () =>
      hasAccountFilter
        ? classifications.filter((classification) =>
            visibleGroups.some((group) => group.classificationId === classification.id),
          )
        : classifications,
    [classifications, hasAccountFilter, visibleGroups],
  );

  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const toggleOpen = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectScope = (nextScope: AccountScope) => {
    setOpenKeys(pathKeysForScope(nextScope, groups));
    onSelectScope(nextScope);
  };

  const jumpToType = (value: GLAccountCategory) => {
    selectScope({ kind: 'category', category: value });
    onExpand?.();
  };

  const selectedCategory = scope.kind === 'category' ? scope.category : undefined;
  const selectedClassificationId =
    scope.kind === 'classification' ? scope.classification.id : undefined;
  const selectedGroupId = scope.kind === 'group' ? scope.group.id : undefined;
  const selectedAccountId = scope.kind === 'account' ? scope.account.id : undefined;

  if (collapsed) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            selectScope({ kind: 'all' });
            onExpand?.();
          }}
          title="All Accounts"
          aria-label="All Accounts"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Layers className="w-4 h-4 text-gray-400" />
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => jumpToType(cat.value)}
            title={cat.label}
            aria-label={cat.label}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Folder className={cn('w-4 h-4', cat.color)} />
          </button>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {isLoading ? (
        <p className="px-3 py-2 text-xs text-gray-400">Loading…</p>
      ) : (
        <>
          <AllAccountsTreeRow
            isSelected={scope.kind === 'all'}
            onSelect={() => selectScope({ kind: 'all' })}
            onCollapseAll={openKeys.size > 0 ? () => setOpenKeys(new Set()) : undefined}
          />
          {CATEGORIES.map((cat) => (
            <TypeNode
              key={cat.value}
              label={cat.label}
              code={cat.code}
              color={cat.color}
              category={cat.value}
              classifications={visibleClassifications.filter((c) => c.category === cat.value)}
              groups={visibleGroups}
              glAccounts={glAccounts}
              unclassifiedAccounts={glAccounts.filter(
                (account) => account.category === cat.value && !account.accountGroupId,
              )}
              selectedCategory={selectedCategory}
              selectedClassificationId={selectedClassificationId}
              selectedGroupId={selectedGroupId}
              selectedAccountId={selectedAccountId}
              openKeys={openKeys}
              onToggleOpen={toggleOpen}
              onSelectScope={selectScope}
            />
          ))}
        </>
      )}
    </div>
  );
}
