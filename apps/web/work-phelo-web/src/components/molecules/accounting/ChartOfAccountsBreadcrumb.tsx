'use client';

import { Fragment, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { AccountScope, CATEGORIES } from '@/components/organisms/accounting/ChartOfAccountsTree';
import type { AccountClassification, AccountGroup } from '@/types/accounting';

interface Crumb {
  label: string;
  scope: AccountScope;
}

interface ChartOfAccountsBreadcrumbProps {
  scope: AccountScope;
  classifications: AccountClassification[];
  groups: AccountGroup[];
  onSelectScope: (scope: AccountScope) => void;
}

export function ChartOfAccountsBreadcrumb({
  scope,
  classifications,
  groups,
  onSelectScope,
}: ChartOfAccountsBreadcrumbProps) {
  const crumbs = useMemo<Crumb[]>(() => {
    const trail: Crumb[] = [{ label: 'All Accounts', scope: { kind: 'all' } }];
    if (scope.kind === 'all') return trail;

    const categoryOf = (category: (typeof CATEGORIES)[number]['value']): Crumb => ({
      label: CATEGORIES.find((c) => c.value === category)?.label ?? category,
      scope: { kind: 'category', category },
    });
    const classificationCrumb = (classification: AccountClassification): Crumb => ({
      label: `${classification.code} ${classification.name}`,
      scope: { kind: 'classification', classification },
    });
    const groupCrumb = (group: AccountGroup): Crumb => ({
      label: `${group.code} ${group.name}`,
      scope: { kind: 'group', group },
    });

    switch (scope.kind) {
      case 'category':
        trail.push(categoryOf(scope.category));
        break;
      case 'classification':
        trail.push(
          categoryOf(scope.classification.category),
          classificationCrumb(scope.classification),
        );
        break;
      case 'group': {
        const classification = classifications.find((c) => c.id === scope.group.classificationId);
        trail.push(categoryOf(scope.group.classification.category));
        if (classification) trail.push(classificationCrumb(classification));
        trail.push(groupCrumb(scope.group));
        break;
      }
      case 'account': {
        const group = groups.find((g) => g.id === scope.account.accountGroupId);
        const classification = group
          ? classifications.find((c) => c.id === group.classificationId)
          : undefined;
        trail.push(categoryOf(scope.account.category));
        if (classification) trail.push(classificationCrumb(classification));
        if (group) trail.push(groupCrumb(group));
        trail.push({ label: scope.account.name, scope });
        break;
      }
    }
    return trail;
  }, [scope, classifications, groups]);

  if (crumbs.length < 2) return null;

  return (
    <nav
      aria-label="Chart of accounts path"
      className="flex flex-wrap items-center gap-1 text-sm text-gray-400"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <ChevronRight className="h-4 w-4 shrink-0" />}
            {isLast ? (
              <span className="font-medium text-gray-700" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelectScope(crumb.scope)}
                className="transition-colors hover:text-gray-700"
              >
                {crumb.label}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
