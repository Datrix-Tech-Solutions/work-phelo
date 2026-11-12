'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderPanel } from '@/components/organisms/inventory/OrderPanel';
import { PurchaseOrdersManager } from '@/components/organisms/inventory/PurchaseOrdersManager';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { pageContent, pageHeader } from '@/lib/layout';

function PurchaseOrdersInner() {
  const { purchaseOrders, isLoading } = usePurchaseOrders();
  // The dashboard's "New Purchase Order" shortcut arrives with ?new=1.
  const [formOpen, setFormOpen] = useState(useSearchParams().get('new') === '1');

  return (
    <>
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
      </div>

      <div className={`${pageContent} flex flex-col`}>
        <PurchaseOrdersManager
          purchaseOrders={purchaseOrders}
          isLoading={isLoading}
          actionButton={{ label: 'New Purchase Order', onClick: () => setFormOpen(true) }}
        />
      </div>

      <OrderPanel kind="PURCHASE" isOpen={formOpen} onClose={() => setFormOpen(false)} />
    </>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense>
      <PurchaseOrdersInner />
    </Suspense>
  );
}
