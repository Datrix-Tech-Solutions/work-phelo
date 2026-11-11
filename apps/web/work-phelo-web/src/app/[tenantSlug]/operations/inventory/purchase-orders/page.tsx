'use client';

import { useState } from 'react';
import { OrderPanel } from '@/components/organisms/inventory/OrderPanel';
import { PurchaseOrdersManager } from '@/components/organisms/inventory/PurchaseOrdersManager';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { pageContent, pageHeader } from '@/lib/layout';

export default function PurchaseOrdersPage() {
  const { purchaseOrders, isLoading } = usePurchaseOrders();
  const [formOpen, setFormOpen] = useState(false);

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
