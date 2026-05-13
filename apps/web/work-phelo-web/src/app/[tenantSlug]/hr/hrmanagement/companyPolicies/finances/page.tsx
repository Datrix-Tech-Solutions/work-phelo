'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { FormField } from '@/components/molecules/shared/FormField';
import { usePayrollSettings, useUpdatePayrollSettings } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { inputClass } from '@/lib/utils';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useHrManagementAccess } from '@/hooks/useHrManagementAccess';

interface FinancesForm {
  payrollTier2FundName: string;
  payrollTier3Enabled: boolean;
  payrollTier3Rate: string;
  payrollTier3SchemeName: string;
}

export default function FinancesPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const { canReadHrSettings } = useHrManagementAccess();

  useEffect(() => {
    if (!canReadHrSettings && !canManagePayroll) {
      router.replace(`/${params.tenantSlug}/hr`);
    }
  }, [canReadHrSettings, canManagePayroll, router, params.tenantSlug]);

  const { data: settings, isLoading } = usePayrollSettings();
  const { mutate: updateSettings, isPending } = useUpdatePayrollSettings();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isDirty, errors },
  } = useForm<FinancesForm>({
    defaultValues: {
      payrollTier2FundName: '',
      payrollTier3Enabled: false,
      payrollTier3Rate: '',
      payrollTier3SchemeName: '',
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        payrollTier2FundName: settings.payrollTier2FundName ?? '',
        payrollTier3Enabled: settings.payrollTier3Enabled,
        payrollTier3Rate:
          settings.payrollTier3Rate != null
            ? String(Math.round(settings.payrollTier3Rate * 100))
            : '',
        payrollTier3SchemeName: settings.payrollTier3SchemeName ?? '',
      });
    }
  }, [settings, reset]);

  const tier3Enabled = useWatch({ control, name: 'payrollTier3Enabled' });

  const onSubmit = (data: FinancesForm) => {
    const rate =
      data.payrollTier3Enabled && data.payrollTier3Rate
        ? parseFloat(data.payrollTier3Rate) / 100
        : undefined;

    updateSettings(
      {
        payrollTier2FundName: data.payrollTier2FundName.trim() || undefined,
        payrollTier3Enabled: data.payrollTier3Enabled,
        payrollTier3Rate: rate,
        payrollTier3SchemeName: data.payrollTier3Enabled
          ? data.payrollTier3SchemeName.trim() || undefined
          : undefined,
      },
      {
        onSuccess: () => toast.success('Finance settings saved'),
        onError: (err) => toast.error(extractError(err, 'Failed to save settings')),
      },
    );
  };

  if (isLoading) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col gap-10">
      {/* Statutory Contributions */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 max-w-xl">
        <FormSection title="Tier 2 — Provident Fund">
          <FormField
            label="Fund Name"
            registration={register('payrollTier2FundName')}
            placeholder="e.g. SSNIT Provident Fund"
          />
          <p className="text-xs text-gray-400 -mt-2">
            The name of your Tier 2 pension fund manager. Shown on payslips and SSNIT reports.
          </p>
        </FormSection>

        <FormSection title="Tier 3 — Voluntary Contribution">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="tier3-enabled"
              {...register('payrollTier3Enabled')}
              className="w-4 h-4 rounded accent-brand cursor-pointer"
            />
            <label
              htmlFor="tier3-enabled"
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              Enable Tier 3 contributions
            </label>
          </div>

          {tier3Enabled && (
            <div className="flex flex-col gap-4 mt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-900">Contribution Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="e.g. 5"
                    {...register('payrollTier3Rate', {
                      required: tier3Enabled ? 'Rate is required when Tier 3 is enabled' : false,
                      min: { value: 0.1, message: 'Rate must be greater than 0' },
                      max: { value: 100, message: 'Rate cannot exceed 100%' },
                    })}
                    className={inputClass(errors.payrollTier3Rate?.message, 'pr-8')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    %
                  </span>
                </div>
                {errors.payrollTier3Rate && (
                  <p className="text-xs text-red-500">{errors.payrollTier3Rate.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-900">Scheme Name</label>
                <input
                  type="text"
                  placeholder="e.g. Company Pension Scheme"
                  {...register('payrollTier3SchemeName', {
                    required: tier3Enabled
                      ? 'Scheme name is required when Tier 3 is enabled'
                      : false,
                  })}
                  className={inputClass(errors.payrollTier3SchemeName?.message)}
                />
                {errors.payrollTier3SchemeName && (
                  <p className="text-xs text-red-500">{errors.payrollTier3SchemeName.message}</p>
                )}
              </div>
            </div>
          )}
        </FormSection>

        <div>
          <Button type="submit" disabled={!isDirty} isLoading={isPending} loadingText="Saving…">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
