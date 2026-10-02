'use client';

import { InlineTable, InlineTableColumn } from '@/components/organisms/shared/InlineTable';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { buildCreateOptionEmptyState } from '@/components/molecules/marketing/CreateOptionEmptyState';
import { useCreateProspectingSetting } from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';

export interface ProductServiceRow {
  id: string;
  productType: string;
  expectedRevenue: string;
  achievedRevenue: string;
  expectedCloseDate: string;
  /** Only captured where `showCommission` is on. */
  commissionRate?: string;
}

/** Rate% of the achieved revenue if any has been entered, otherwise of the expected revenue. */
export function derivedCommission(row: ProductServiceRow): number {
  const rate = parseFloat(row.commissionRate ?? '');
  if (!Number.isFinite(rate)) return 0;
  const achieved = row.achievedRevenue.trim() !== '' ? parseFloat(row.achievedRevenue) : NaN;
  const base = Number.isFinite(achieved) ? achieved : parseFloat(row.expectedRevenue) || 0;
  return Math.round(((base * rate) / 100 + Number.EPSILON) * 100) / 100;
}

function emptyRow(): ProductServiceRow {
  return {
    id: crypto.randomUUID(),
    productType: '',
    expectedRevenue: '',
    achievedRevenue: '',
    expectedCloseDate: '',
  };
}

interface Props {
  rows: ProductServiceRow[];
  onChange: (rows: ProductServiceRow[]) => void;
  productTypeOptions?: { value: string; label: string }[];
  /** Adds the commission rate and amount columns. */
  showCommission?: boolean;
}

export function ProductServiceForm({
  rows,
  onChange,
  productTypeOptions = [],
  showCommission = false,
}: Props) {
  const toast = useToast();
  const createProduct = useCreateProspectingSetting('products');

  function update(index: number, key: keyof ProductServiceRow, value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  const totalExpected = rows.reduce((sum, r) => sum + (parseFloat(r.expectedRevenue) || 0), 0);
  const totalAchieved = rows.reduce((sum, r) => sum + (parseFloat(r.achievedRevenue) || 0), 0);

  const fmt = (n: number) =>
    n === 0
      ? '—'
      : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const columns: InlineTableColumn[] = [
    {
      key: 'product',
      label: 'Product',
      width: 'minmax(150px, 1fr)',
      renderField: (i) => (
        <SearchSelect
          placeholder="Select or type to add new"
          options={productTypeOptions}
          value={rows[i].productType}
          onChange={(v) => update(i, 'productType', v)}
          emptyState={buildCreateOptionEmptyState(
            'product',
            createProduct,
            (id) => update(i, 'productType', id),
            toast,
          )}
        />
      ),
    },
    {
      key: 'expectedRevenue',
      label: 'Expected Revenue',
      width: '150px',
      align: 'right',
      renderField: (i) => (
        <CurrencyInput
          currency="GHS"
          lockCurrency
          value={rows[i].expectedRevenue}
          onValueChange={(v) => update(i, 'expectedRevenue', v)}
        />
      ),
      renderFooter: () => (
        <span className="text-sm font-semibold text-gray-900">{fmt(totalExpected)}</span>
      ),
    },
    {
      key: 'achievedRevenue',
      label: 'Achieved Revenue',
      width: '150px',
      align: 'right',
      renderField: (i) => (
        <CurrencyInput
          currency="GHS"
          lockCurrency
          value={rows[i].achievedRevenue}
          onValueChange={(v) => update(i, 'achievedRevenue', v)}
        />
      ),
      renderFooter: () => (
        <span className="text-sm font-semibold text-gray-900">{fmt(totalAchieved)}</span>
      ),
    },
    {
      key: 'expectedCloseDate',
      label: 'Expected Close Date',
      width: '150px',
      align: 'right',
      renderField: (i) => (
        <DatePicker
          value={rows[i].expectedCloseDate}
          onChange={(v) => update(i, 'expectedCloseDate', v)}
        />
      ),
    },
    ...(showCommission
      ? [
          {
            key: 'commissionRate',
            label: 'Commission',
            width: '100px',
            align: 'right' as const,
            renderField: (i: number) => (
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={rows[i].commissionRate ?? ''}
                onChange={(e) => update(i, 'commissionRate', e.target.value)}
                rightElement={<span className="text-sm text-gray-400">%</span>}
              />
            ),
          },
          {
            key: 'commissionAmount',
            label: 'Commission Amount',
            width: '150px',
            align: 'right' as const,
            renderField: (i: number) => (
              <span className="block text-right text-sm font-semibold text-gray-600">
                {fmt(derivedCommission(rows[i]))}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <InlineTable
      title="Products / Services"
      addLabel="Add Product"
      columns={columns}
      fieldIds={rows.map((r) => r.id)}
      onAddRow={() => onChange([...rows, emptyRow()])}
      onRemoveRow={(i) => onChange(rows.filter((_, idx) => idx !== i))}
    />
  );
}
