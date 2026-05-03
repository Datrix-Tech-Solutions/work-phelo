'use client';

import { use } from 'react';
import { AssetsContent } from '@/components/organisms/assets/AssetsContent';

export default function AssetsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <AssetsContent />
    </div>
  );
}
