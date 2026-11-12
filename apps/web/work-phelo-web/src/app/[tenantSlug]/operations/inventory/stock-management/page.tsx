'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StockMovementsTable } from '@/components/organisms/inventory/StockMovementsTable';
import { StockMovementTypeModal } from '@/components/organisms/inventory/StockMovementTypeModal';
import { StockMovementPanel } from '@/components/organisms/inventory/StockMovementPanel';
import { pageHeader, pageContent } from '@/lib/layout';
import { useStockMovements, type StockMovementType } from '@/hooks/inventory/useStockMovements';
import {
  useStockMovementDrafts,
  type StockMovementDraft,
} from '@/hooks/inventory/useStockMovementDrafts';

function StockManagementInner() {
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  // The dashboard's stock shortcuts arrive with ?type=STOCK_IN (or STOCK_OUT, TRANSFER, ADJUSTMENT).
  const linkedType = useSearchParams().get('type');
  const [movementType, setMovementType] = useState<StockMovementType | null>(
    linkedType === 'STOCK_IN' ||
      linkedType === 'STOCK_OUT' ||
      linkedType === 'TRANSFER' ||
      linkedType === 'ADJUSTMENT'
      ? linkedType
      : null,
  );
  const { movements, isLoading } = useStockMovements();

  const { drafts, draftMovements } = useStockMovementDrafts();
  const [activeDraft, setActiveDraft] = useState<StockMovementDraft | null>(null);
  const closePanel = () => {
    setMovementType(null);
    setActiveDraft(null);
  };
  const openDraft = (id: string) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return;
    setActiveDraft(draft);
    setMovementType(draft.type);
  };

  return (
    <>
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-semibold text-gray-900">Stock Management</h1>
      </div>

      <div className={`${pageContent} flex flex-col`}>
        <StockMovementsTable
          movements={[...draftMovements, ...movements]}
          isLoading={isLoading}
          onDraftClick={openDraft}
          typeFilter
          actionButton={{ label: 'Record Movement', onClick: () => setTypePickerOpen(true) }}
        />
      </div>

      <StockMovementTypeModal
        isOpen={typePickerOpen}
        onClose={() => setTypePickerOpen(false)}
        onSelect={(t) => {
          setTypePickerOpen(false);
          setMovementType(t);
        }}
      />
      <StockMovementPanel
        key={`STOCK_IN-${activeDraft?.type === 'STOCK_IN' ? activeDraft.id : 'new'}`}
        type="STOCK_IN"
        isOpen={movementType === 'STOCK_IN'}
        onClose={closePanel}
        draft={activeDraft?.type === 'STOCK_IN' ? activeDraft : null}
      />
      <StockMovementPanel
        key={`STOCK_OUT-${activeDraft?.type === 'STOCK_OUT' ? activeDraft.id : 'new'}`}
        type="STOCK_OUT"
        isOpen={movementType === 'STOCK_OUT'}
        onClose={closePanel}
        draft={activeDraft?.type === 'STOCK_OUT' ? activeDraft : null}
      />
      <StockMovementPanel
        key={`TRANSFER-${activeDraft?.type === 'TRANSFER' ? activeDraft.id : 'new'}`}
        type="TRANSFER"
        isOpen={movementType === 'TRANSFER'}
        onClose={closePanel}
        draft={activeDraft?.type === 'TRANSFER' ? activeDraft : null}
      />
      <StockMovementPanel
        key={`ADJUSTMENT-${activeDraft?.type === 'ADJUSTMENT' ? activeDraft.id : 'new'}`}
        type="ADJUSTMENT"
        isOpen={movementType === 'ADJUSTMENT'}
        onClose={closePanel}
        draft={activeDraft?.type === 'ADJUSTMENT' ? activeDraft : null}
      />
    </>
  );
}

export default function StockManagementPage() {
  return (
    <Suspense>
      <StockManagementInner />
    </Suspense>
  );
}
