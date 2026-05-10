'use client';

import { useState } from 'react';
import { Plus, CheckCircle2, Clock } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';

export interface DeductionItem {
  id: string;
  name: string;
  totalAmount: number;
  monthlyRate: number;
  amountPaid: number;
  startDate: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  items: DeductionItem[];
  onSave: (items: DeductionItem[]) => void;
}

interface FormState {
  name: string;
  totalAmount: string;
  monthlyRate: string;
  startDate: string;
}

function fmtAmt(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyForm(): FormState {
  return {
    name: '',
    totalAmount: '',
    monthlyRate: '',
    startDate: new Date().toISOString().slice(0, 10),
  };
}

function DeductionCard({
  item,
  onEdit,
  onDelete,
}: {
  item: DeductionItem;
  onEdit: (item: DeductionItem) => void;
  onDelete: (id: string) => void;
}) {
  const balance = Math.max(0, item.totalAmount - item.amountPaid);
  const isCompleted = balance === 0;
  const progress =
    item.totalAmount > 0 ? Math.min(100, (item.amountPaid / item.totalAmount) * 100) : 0;
  const monthsLeft =
    !isCompleted && item.monthlyRate > 0 ? Math.ceil(balance / item.monthlyRate) : 0;

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
        isCompleted ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`font-semibold text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-900'}`}>
          {item.name}
        </p>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {isCompleted ? 'Completed' : 'Active'}
        </span>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-400' : 'bg-brand'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-gray-400">Total Amount</p>
          <p className="font-medium text-gray-700">{fmtAmt(item.totalAmount)}</p>
        </div>
        <div>
          <p className="text-gray-400">Monthly Rate</p>
          <p className="font-semibold text-gray-900">{fmtAmt(item.monthlyRate)}</p>
        </div>
        <div>
          <p className="text-gray-400">Paid So Far</p>
          <p className="font-medium text-emerald-600">{fmtAmt(item.amountPaid)}</p>
        </div>
        <div>
          <p className="text-gray-400">Balance</p>
          <p className={`font-semibold ${isCompleted ? 'text-gray-400' : 'text-gray-900'}`}>
            {fmtAmt(balance)}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Started{' '}
        {new Date(item.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
        {monthsLeft > 0 && ` · ~${monthsLeft} month${monthsLeft !== 1 ? 's' : ''} remaining`}
      </p>

      {!isCompleted && (
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100">
          <button
            onClick={() => onEdit(item)}
            className="text-xs text-brand hover:text-brand/80 font-medium transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function DeductionsPanelContent({ employeeName, items, onSave, onClose }: Omit<Props, 'isOpen'>) {
  const [deductions, setDeductions] = useState<DeductionItem[]>(items);
  const [showForm, setShowForm] = useState(items.length === 0);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const activeMonthlyTotal = deductions
    .filter((d) => d.amountPaid < d.totalAmount)
    .reduce((sum, d) => sum + d.monthlyRate, 0);

  const validate = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.totalAmount || Number(form.totalAmount) <= 0) e.totalAmount = 'Enter a valid amount';
    if (!form.monthlyRate || Number(form.monthlyRate) <= 0) e.monthlyRate = 'Enter a valid rate';
    else if (Number(form.monthlyRate) > Number(form.totalAmount))
      e.monthlyRate = 'Rate cannot exceed total';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmitForm = () => {
    if (!validate()) return;
    if (editingId) {
      setDeductions((prev) =>
        prev.map((d) =>
          d.id === editingId
            ? {
                ...d,
                name: form.name.trim(),
                totalAmount: Number(form.totalAmount),
                monthlyRate: Number(form.monthlyRate),
                startDate: form.startDate,
              }
            : d,
        ),
      );
      setEditingId(null);
    } else {
      setDeductions((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: form.name.trim(),
          totalAmount: Number(form.totalAmount),
          monthlyRate: Number(form.monthlyRate),
          amountPaid: 0,
          startDate: form.startDate,
        },
      ]);
    }
    setForm(emptyForm());
    setErrors({});
    setShowForm(false);
  };

  const handleEdit = (item: DeductionItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      totalAmount: String(item.totalAmount),
      monthlyRate: String(item.monthlyRate),
      startDate: item.startDate,
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
    setShowForm(deductions.length === 0);
  };

  const previewMonths =
    form.totalAmount && form.monthlyRate && Number(form.monthlyRate) > 0
      ? Math.ceil(Number(form.totalAmount) / Number(form.monthlyRate))
      : null;

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Deductions"
      description={employeeName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(deductions);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {activeMonthlyTotal > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-brand/5 rounded-xl border border-brand/10">
            <span className="text-sm font-medium text-gray-600">This month&apos;s deduction</span>
            <span className="text-sm font-semibold text-brand">{fmtAmt(activeMonthlyTotal)}</span>
          </div>
        )}

        {deductions.map((item) => (
          <DeductionCard
            key={item.id}
            item={item}
            onEdit={handleEdit}
            onDelete={(id) => setDeductions((prev) => prev.filter((d) => d.id !== id))}
          />
        ))}

        {showForm ? (
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">
              {editingId ? 'Edit Deduction' : 'New Deduction'}
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Name</label>
              <input
                type="text"
                placeholder="e.g. Staff Loan"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputClass(errors.name)}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Total Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  value={form.totalAmount}
                  onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))}
                  className={inputClass(errors.totalAmount)}
                />
                {errors.totalAmount && <p className="text-xs text-red-500">{errors.totalAmount}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Monthly Rate</label>
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  value={form.monthlyRate}
                  onChange={(e) => setForm((p) => ({ ...p, monthlyRate: e.target.value }))}
                  className={inputClass(errors.monthlyRate)}
                />
                {errors.monthlyRate && <p className="text-xs text-red-500">{errors.monthlyRate}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className={inputClass(undefined)}
              />
            </div>

            {previewMonths !== null && previewMonths > 0 && (
              <p className="text-xs text-gray-400">
                ~{previewMonths} month{previewMonths !== 1 ? 's' : ''} to clear at this rate
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" onClick={handleCancelForm}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmitForm}>
                {editingId ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-sm text-brand hover:text-brand/80 transition-colors py-1"
          >
            <Plus className="w-4 h-4" />
            Add Deduction
          </button>
        )}
      </div>
    </SidePanel>
  );
}

export function DeductionsPanel({ isOpen, ...props }: Props) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return <DeductionsPanelContent key={`${props.employeeName}-${props.items.length}`} {...props} />;
}
