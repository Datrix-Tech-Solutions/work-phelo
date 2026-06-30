import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { Vendor } from '@/types/accounting';

function fmtBalance(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface VendorOverviewProps {
  vendor: Vendor;
}

export function VendorOverview({ vendor }: VendorOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Vendor Code" value={vendor.vendorCode} />
        <DetailField label="Vendor Name" value={vendor.vendorName} />
        <DetailField label="Contact Person" value={vendor.contactPerson ?? '—'} />
        <DetailField label="Email" value={vendor.email ?? '—'} />
        <DetailField label="Phone" value={vendor.phone ?? '—'} />
        <DetailField label="Currency" value={vendor.currency} />
        <DetailField
          label="Outstanding Balance"
          value={fmtBalance(vendor.outstandingBalance, vendor.currency)}
        />
        <DetailField
          label="Status"
          value={
            <Badge
              label={vendor.status}
              variant={vendor.status === 'Active' ? 'success' : 'neutral'}
            />
          }
        />
      </div>
    </CollapsibleOverview>
  );
}
