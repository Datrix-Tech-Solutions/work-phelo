import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { BankAccount } from '@/types/accounting';

interface BankAccountOverviewProps {
  account: BankAccount;
}

export function BankAccountOverview({ account }: BankAccountOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Account Name" value={account.accountName} />
        <DetailField label="Account Type" value={account.accountType} />
        <DetailField label="Bank Name" value={account.bankName} />
        <DetailField label="Bank Code" value={account.bankCode} />
        <DetailField label="Bank Branch" value={account.bankBranch} />
        <DetailField label="Account Number" value={account.accountNumber} />
        <DetailField
          label="Status"
          value={
            <Badge
              label={account.status}
              variant={account.status === 'Active' ? 'success' : 'neutral'}
            />
          }
        />
      </div>
    </CollapsibleOverview>
  );
}
