'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { PayrollAccountingSetup } from '@/components/organisms/accounting/panels/PayrollAccountingSetup';
import { SourceBillingSetup } from '@/components/organisms/accounting/panels/SourceBillingSetup';
import { SOURCE_MODULE_LABELS } from '@/lib/accounting/sourceModules';
import type { SourceTypeDefinition } from '@/types/accounting';

/** Each module's own integration setup, opened in place instead of navigating away — shared
 *  between the Source Types table's row action and the source type detail page's header
 *  action. Add a case here as more modules grow one. */
export function SourceTypeManagePanel({
  sourceType,
  onClose,
}: {
  sourceType: SourceTypeDefinition | null;
  onClose: () => void;
}) {
  return (
    <SidePanel
      isOpen={!!sourceType}
      onClose={onClose}
      width="sm:w-[480px]"
      title={sourceType ? `Manage ${sourceType.name}` : 'Manage'}
      description={
        sourceType
          ? `${SOURCE_MODULE_LABELS[sourceType.module]} — ${sourceType.name} integration`
          : undefined
      }
    >
      {sourceType?.module === 'HR' ? (
        <PayrollAccountingSetup sourceType={sourceType} />
      ) : sourceType ? (
        // Every other module raises transactions through the same set-up; one that does not says so.
        <SourceBillingSetup sourceType={sourceType} />
      ) : null}
    </SidePanel>
  );
}
