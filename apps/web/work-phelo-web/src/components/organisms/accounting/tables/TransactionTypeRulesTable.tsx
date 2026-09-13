'use client';

import { useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { Modal } from '@/components/organisms/shared/Modal';
import { TransactionTypeRulePanel } from '@/components/organisms/accounting/panels/TransactionTypeRulePanel';
import { TypeChip } from '@/components/atoms/TypeChip';
import { cardClass, cn, inputClass } from '@/lib/utils';
import {
  TRANSACTION_TYPE_CATEGORY_CHIP_COLOR,
  TRANSACTION_TYPE_CATEGORY_LABEL,
} from '@/lib/accounting/transactionTypeCategory';
import {
  useDeleteTransactionTypeRule,
  useTransactionTypeRules,
  useTransactionTypes,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { TransactionTypeDefinition, TransactionTypeRule } from '@/types/accounting';

type PanelState = { rule: TransactionTypeRule | null; transactionTypeId?: string } | null;

export function TransactionTypeRulesTable() {
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<PanelState>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionTypeRule | null>(null);

  const { data: transactionTypes = [], isLoading: isLoadingTypes } = useTransactionTypes();
  const { data: rules = [], isLoading: isLoadingRules } = useTransactionTypeRules();
  const deleteRule = useDeleteTransactionTypeRule();
  const toast = useToast();
  const isLoading = isLoadingTypes || isLoadingRules;

  const rulesByType = useMemo(() => {
    const map = new Map<string, TransactionTypeRule[]>();
    for (const rule of rules) {
      const list = map.get(rule.transactionTypeId) ?? [];
      list.push(rule);
      map.set(rule.transactionTypeId, list);
    }
    return map;
  }, [rules]);

  const query = search.trim().toLowerCase();
  const groups = useMemo(() => {
    return transactionTypes
      .map((type) => {
        const typeRules = rulesByType.get(type.id) ?? [];
        const typeMatches = `${type.name} ${type.code}`.toLowerCase().includes(query);
        const matchedRules = typeMatches
          ? typeRules
          : typeRules.filter((rule) =>
              `${rule.sourceType ?? ''} ${rule.role ?? ''} ${rule.account.code} ${rule.account.name} ${rule.description ?? ''}`
                .toLowerCase()
                .includes(query),
            );
        return { type, rules: matchedRules };
      })
      .filter(
        (group) =>
          !query || group.rules.length > 0 || group.type.name.toLowerCase().includes(query),
      );
  }, [transactionTypes, rulesByType, query]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteRule.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => toast.error(extractError(error, 'Unable to delete rule')),
    });
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className={cardClass('px-4 py-2 shrink-0')}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search rules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass(undefined, 'pl-9 pr-4 py-2')}
            />
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={() => setPanel({ rule: null })} className="group">
            Add Rule
            <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:ml-1.5 transition-[width,margin] duration-300 ease-out">
              <Icons.Plus className="w-4 h-4 shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out" />
            </span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
        {isLoading ? (
          <div className={cardClass('flex items-center justify-center py-12')}>
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-brand animate-spin" />
                <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Loading...</p>
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div
            className={cardClass(
              'flex flex-col items-center justify-center gap-1 py-12 text-center',
            )}
          >
            <p className="text-base font-medium text-gray-600">
              {transactionTypes.length === 0 ? 'No transaction types found' : 'No rules found'}
            </p>
            <p className="text-sm text-gray-400">
              {transactionTypes.length === 0
                ? 'Add a transaction type first, then define its posting rules here.'
                : 'Try adjusting your search.'}
            </p>
          </div>
        ) : (
          groups.map(({ type, rules: groupRules }) => (
            <RuleGroup
              key={type.id}
              type={type}
              rules={groupRules}
              onAddRule={() => setPanel({ rule: null, transactionTypeId: type.id })}
              onUpdateRule={(rule) => setPanel({ rule })}
              onDeleteRule={(rule) => setDeleteTarget(rule)}
            />
          ))
        )}
      </div>

      <TransactionTypeRulePanel
        isOpen={!!panel}
        rule={panel?.rule ?? null}
        defaultTransactionTypeId={panel?.transactionTypeId}
        onClose={() => setPanel(null)}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Rule"
        description="Are you sure you want to delete this rule? This cannot be undone."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={deleteRule.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      />
    </div>
  );
}

function RuleGroup({
  type,
  rules,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
}: {
  type: TransactionTypeDefinition;
  rules: TransactionTypeRule[];
  onAddRule: () => void;
  onUpdateRule: (rule: TransactionTypeRule) => void;
  onDeleteRule: (rule: TransactionTypeRule) => void;
}) {
  const columns =
    'minmax(140px, 1fr) minmax(120px, 1fr) minmax(160px, 1.2fr) minmax(180px, 1.5fr) 140px';

  return (
    <div className={cardClass('overflow-hidden shrink-0')}>
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-gray-900 truncate">{type.name}</span>
          <span className="text-xs text-gray-400">{type.code}</span>
          <TypeChip
            label={TRANSACTION_TYPE_CATEGORY_LABEL[type.category]}
            color={TRANSACTION_TYPE_CATEGORY_CHIP_COLOR[type.category]}
          />
        </div>
        <button
          type="button"
          onClick={onAddRule}
          className="shrink-0 text-sm font-medium text-brand hover:bg-brand/5 px-2 py-1 rounded-lg transition-colors"
        >
          + Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="px-6 py-4 text-sm text-gray-400">No rules yet for this transaction type.</p>
      ) : (
        <div className="min-w-full">
          <div
            className="grid gap-x-4 px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50"
            style={{ gridTemplateColumns: columns }}
          >
            <span>Source Type</span>
            <span>Role</span>
            <span>Account</span>
            <span>Description</span>
            <span />
          </div>
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="grid gap-x-4 px-6 py-3 items-center text-sm text-gray-800 border-t border-gray-100"
              style={{ gridTemplateColumns: columns }}
            >
              <span className="min-w-0 truncate">{rule.sourceType ?? '—'}</span>
              <span className="min-w-0 truncate">{rule.role ?? '—'}</span>
              <span className="min-w-0 truncate">
                {rule.account.code} – {rule.account.name}
              </span>
              <span className="min-w-0 truncate text-gray-600">{rule.description ?? '—'}</span>
              <span className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateRule(rule)}
                  className="text-sm font-medium text-brand hover:bg-brand/5 px-2 py-1 rounded-lg transition-colors"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRule(rule)}
                  className={cn(
                    'text-sm font-medium text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors',
                  )}
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
