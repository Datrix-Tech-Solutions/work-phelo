import { LocalInventoryDataImport } from '@/components/organisms/inventory/LocalInventoryDataImport';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocalInventoryDataImport />
      {children}
    </>
  );
}
