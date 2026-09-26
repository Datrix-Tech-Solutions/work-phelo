import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { AccountingCashAccount, AccountingCashAccountKind } from '@/types/accounting';

const KIND_LABEL: Record<AccountingCashAccountKind, string> = {
  BANK: 'Bank',
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  OTHER: 'Other',
};

interface CashAccountOverviewProps {
  account: AccountingCashAccount;
}

export function CashAccountOverview({ account }: CashAccountOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Account Name" value={account.name} />
        <DetailField label="Type" value={KIND_LABEL[account.accountKind]} />
        <DetailField label="Currency" value={account.currency} />
        <DetailField
          label="Status"
          value={
            <Badge
              label={account.isActive ? 'Active' : 'Inactive'}
              variant={account.isActive ? 'success' : 'neutral'}
            />
          }
        />
        <DetailField
          label="GL Account"
          value={`${account.glAccount.code} – ${account.glAccount.name}`}
        />
        {account.bankName && <DetailField label="Bank Name" value={account.bankName} />}
        {account.branch && <DetailField label="Branch" value={account.branch} />}
        {account.accountNumber && (
          <DetailField label="Account Number" value={account.accountNumber} />
        )}
        {account.description && <DetailField label="Description" value={account.description} />}
      </div>
    </CollapsibleOverview>
  );
}
