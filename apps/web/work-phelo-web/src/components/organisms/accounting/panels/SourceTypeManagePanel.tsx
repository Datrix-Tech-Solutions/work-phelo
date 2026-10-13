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
      title={sourceType ? `Manage ${sourceType.name}` : 'Manage'}
      description={
        sourceType
          ? `${SOURCE_MODULE_LABELS[sourceType.module]} — ${sourceType.name} integration`
          : undefined
      }
    >
      {sourceType?.module === 'HR' ? (
        <PayrollAccountingSetup sourceType={sourceType} />
      ) : sourceType?.module === 'MARKETING' ? (
        <SourceBillingSetup sourceType={sourceType} />
      ) : (
        <p className="text-sm text-gray-500">
          This will surface {sourceType ? SOURCE_MODULE_LABELS[sourceType.module] : 'the module'}
          &apos;s own integration setup here — the same settings screen it manages from its own
          module, opened in place instead of navigating away.
        </p>
      )}
    </SidePanel>
  );
}
