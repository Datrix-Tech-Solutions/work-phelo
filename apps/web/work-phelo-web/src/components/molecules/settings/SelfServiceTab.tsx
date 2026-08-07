'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AxiosError } from 'axios';
import { FileImage, Landmark, Pencil, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Toggle } from '@/components/atoms/Toggle';
import { FormField } from '@/components/molecules/shared/FormField';
import { useToast } from '@/hooks/useToast';
import {
  useCreateTenantDocumentBankAccount,
  useDeactivateTenantDocumentBankAccount,
  useTenantDocumentBankAccounts,
  useTenantDocumentProfile,
  useUpdateTenantDocumentBankAccount,
  useUpdateTenantDocumentProfile,
  useUploadTenantDocumentAsset,
} from '@/hooks/useTenantDocumentProfile';
import { useAuthStore } from '@/store/auth.store';
import {
  DOCUMENT_PROFILE_CURRENCIES,
  TenantBankAccount,
  TenantBankAccountPayload,
  TenantDocumentProfile,
  UpsertTenantDocumentProfilePayload,
} from '@/types/tenant-document-profile';

type ProfileFormValues = {
  displayName: string;
  legalName: string;
  registrationNumber: string;
  taxNumber: string;
  physicalAddress: string;
  postalAddress: string;
  phone: string;
  email: string;
  website: string;
  footerText: string;
  defaultCurrency: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
};

type BankFormValues = {
  bankName: string;
  branchName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  swiftCode: string;
  sortCode: string;
  isDefault: boolean;
};

const currencyOptions = DOCUMENT_PROFILE_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency,
}));

const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatBytes(value: number | null): string {
  if (value === null) return 'Not available';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function profileDefaults(profile?: TenantDocumentProfile): ProfileFormValues {
  return {
    displayName: profile?.displayName ?? '',
    legalName: profile?.legalName ?? '',
    registrationNumber: profile?.registrationNumber ?? '',
    taxNumber: profile?.taxNumber ?? '',
    physicalAddress: profile?.physicalAddress ?? '',
    postalAddress: profile?.postalAddress ?? '',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    website: profile?.website ?? '',
    footerText: profile?.footerText ?? '',
    defaultCurrency: profile?.defaultCurrency ?? 'GHS',
    authorizedSignatoryName: profile?.authorizedSignatoryName ?? '',
    authorizedSignatoryTitle: profile?.authorizedSignatoryTitle ?? '',
  };
}

function bankDefaults(account?: TenantBankAccount): BankFormValues {
  return {
    bankName: account?.bankName ?? '',
    branchName: account?.branchName ?? '',
    accountName: account?.accountName ?? '',
    accountNumber: account?.accountNumber ?? '',
    currency: account?.currency ?? 'GHS',
    swiftCode: account?.swiftCode ?? '',
    sortCode: account?.sortCode ?? '',
    isDefault: account?.isDefault ?? false,
  };
}

function toBankPayload(values: BankFormValues): TenantBankAccountPayload {
  return {
    bankName: values.bankName.trim(),
    branchName: nullableText(values.branchName),
    accountName: values.accountName.trim(),
    accountNumber: values.accountNumber.trim(),
    currency: values.currency.trim().toUpperCase(),
    swiftCode: nullableText(values.swiftCode),
    sortCode: nullableText(values.sortCode),
    isDefault: values.isDefault,
    isActive: true,
  };
}

export function SelfServiceTab() {
  const user = useAuthStore((state) => state.user);
  const tenantId = user?.tenantId;
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const toast = useToast();
  const { data: profile, isLoading, isError } = useTenantDocumentProfile(tenantId);
  const updateProfile = useUpdateTenantDocumentProfile(tenantId ?? '');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({ defaultValues: profileDefaults() });

  useEffect(() => {
    if (profile) reset(profileDefaults(profile));
  }, [profile, reset]);

  const selectedCurrency = useWatch({ control, name: 'defaultCurrency' });

  if (!canManage || !tenantId) {
    return (
      <div className="py-6 max-w-2xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Document Profile</h3>
          <p className="mt-2 text-sm text-gray-500">
            Only tenant administrators can manage official document branding.
          </p>
        </div>
      </div>
    );
  }

  const onSubmit = (values: ProfileFormValues) => {
    const payload: UpsertTenantDocumentProfilePayload = {
      displayName: values.displayName.trim(),
      legalName: values.legalName.trim(),
      registrationNumber: nullableText(values.registrationNumber),
      taxNumber: nullableText(values.taxNumber),
      physicalAddress: nullableText(values.physicalAddress),
      postalAddress: nullableText(values.postalAddress),
      phone: nullableText(values.phone),
      email: nullableText(values.email),
      website: nullableText(values.website),
      footerText: nullableText(values.footerText),
      defaultCurrency: values.defaultCurrency.trim().toUpperCase(),
      authorizedSignatoryName: nullableText(values.authorizedSignatoryName),
      authorizedSignatoryTitle: nullableText(values.authorizedSignatoryTitle),
    };

    updateProfile.mutate(payload, {
      onSuccess: () => toast.success('Document profile saved'),
      onError: (error) => toast.error(errorMessage(error, 'Failed to save document profile')),
    });
  };

  return (
    <div className="py-6 flex flex-col gap-6 max-w-5xl">
      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
          <div>
            <h3 className="text-sm font-semibold text-blue-950">Official document profile</h3>
            <p className="mt-1 text-sm text-blue-800">
              These values are used for official documents such as Reinsurance slips, notes and
              future generated PDFs. Newly generated documents use the latest saved profile.
              Existing generated documents keep their original snapshot.
            </p>
          </div>
        </div>
      </section>

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Document profile could not be loaded. Please refresh and try again.
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-2xl border border-gray-200 bg-white p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Company / Document Profile</h3>
            <p className="mt-1 text-sm text-gray-500">
              Maintain the legal identity, contact details and signatory shown on official
              documents.
            </p>
          </div>
          {profile?.defaultsApplied && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Using tenant defaults
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Display Name"
            registration={register('displayName', {
              required: 'Display name is required',
              minLength: { value: 2, message: 'Use at least 2 characters' },
            })}
            error={errors.displayName}
          />
          <FormField
            label="Legal Name"
            registration={register('legalName', {
              required: 'Legal name is required',
              minLength: { value: 2, message: 'Use at least 2 characters' },
            })}
            error={errors.legalName}
          />
          <FormField label="Registration Number" registration={register('registrationNumber')} />
          <FormField label="Tax Number" registration={register('taxNumber')} />
          <FormField
            label="Phone"
            registration={register('phone', {
              maxLength: { value: 50, message: 'Phone must be 50 characters or fewer' },
            })}
            error={errors.phone}
          />
          <FormField
            label="Email"
            type="email"
            registration={register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
            error={errors.email}
          />
          <FormField
            label="Website"
            placeholder="https://example.com"
            registration={register('website', {
              validate: (value) => {
                if (!value?.trim()) return true;
                try {
                  const url = new URL(value);
                  return url.protocol === 'https:' || 'Website must start with https://';
                } catch {
                  return 'Enter a valid HTTPS URL';
                }
              },
            })}
            error={errors.website}
          />
          <SearchSelect
            label="Default Currency"
            options={currencyOptions}
            value={selectedCurrency}
            onChange={(value) => setValue('defaultCurrency', value, { shouldDirty: true })}
          />
          <FormField
            label="Physical Address"
            type="textarea"
            rows={3}
            registration={register('physicalAddress')}
          />
          <FormField
            label="Postal Address"
            type="textarea"
            rows={3}
            registration={register('postalAddress')}
          />
          <FormField
            label="Authorized Signatory Name"
            registration={register('authorizedSignatoryName')}
          />
          <FormField
            label="Authorized Signatory Title"
            registration={register('authorizedSignatoryTitle')}
          />
          <div className="md:col-span-2">
            <FormField
              label="Footer Text"
              type="textarea"
              rows={3}
              registration={register('footerText')}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 pt-5">
          <p className="text-xs text-gray-400">
            Version {profile?.version ?? 0}
            {profile?.updatedAt ? ` · Updated ${new Date(profile.updatedAt).toLocaleString()}` : ''}
          </p>
          <Button
            type="submit"
            isLoading={updateProfile.isPending || isLoading}
            loadingText="Saving..."
          >
            Save Document Profile
          </Button>
        </div>
      </form>

      <AssetSection tenantId={tenantId} profile={profile} />
      <BankAccountsSection tenantId={tenantId} />
    </div>
  );
}

function AssetSection({
  tenantId,
  profile,
}: {
  tenantId: string;
  profile?: TenantDocumentProfile;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <AssetUploadCard
        tenantId={tenantId}
        assetType="logo"
        title="Document Logo"
        description="PNG, JPEG or WEBP. Max 2 MB. Stored privately and shown on newly generated PDFs."
        fileName={profile?.logoFileName ?? null}
        mimeType={profile?.logoMimeType ?? null}
        sizeBytes={profile?.logoSizeBytes ?? null}
        maxBytes={2 * 1024 * 1024}
      />
      <AssetUploadCard
        tenantId={tenantId}
        assetType="signature"
        title="Authorized Signature"
        description="PNG, JPEG or WEBP. Max 1 MB. Stored privately for official document signing blocks."
        fileName={profile?.signatureFileName ?? null}
        mimeType={profile?.signatureMimeType ?? null}
        sizeBytes={profile?.signatureSizeBytes ?? null}
        maxBytes={1024 * 1024}
      />
    </section>
  );
}

function AssetUploadCard({
  tenantId,
  assetType,
  title,
  description,
  fileName,
  mimeType,
  sizeBytes,
  maxBytes,
}: {
  tenantId: string;
  assetType: 'logo' | 'signature';
  title: string;
  description: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  maxBytes: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const upload = useUploadTenantDocumentAsset(tenantId, assetType);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!allowedImageTypes.has(file.type)) {
      toast.error('Image must be PNG, JPEG or WEBP.');
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`${title} must be ${formatBytes(maxBytes)} or smaller.`);
      return;
    }

    upload.mutate(file, {
      onSuccess: () => {
        toast.success(`${title} uploaded`);
        if (inputRef.current) inputRef.current.value = '';
      },
      onError: (error) =>
        toast.error(errorMessage(error, `Failed to upload ${title.toLowerCase()}`)),
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-gray-100 p-2 text-gray-600">
          <FileImage className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
        {fileName ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">File</dt>
              <dd className="truncate font-medium text-gray-900">{fileName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium text-gray-900">{mimeType ?? 'Not available'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Size</dt>
              <dd className="font-medium text-gray-900">{formatBytes(sizeBytes)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">
            No {assetType} uploaded yet. The API does not expose a public preview URL, so metadata
            will be shown after upload.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          isLoading={upload.isPending}
          loadingText="Uploading..."
          onClick={() => inputRef.current?.click()}
          icon={<Upload className="h-4 w-4" />}
        >
          {fileName ? 'Replace File' : 'Upload File'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>
    </div>
  );
}

function BankAccountsSection({ tenantId }: { tenantId: string }) {
  const { data: bankAccounts = [], isLoading } = useTenantDocumentBankAccounts(tenantId);
  const createAccount = useCreateTenantDocumentBankAccount(tenantId);
  const updateAccount = useUpdateTenantDocumentBankAccount(tenantId);
  const deactivateAccount = useDeactivateTenantDocumentBankAccount(tenantId);
  const toast = useToast();
  const [editingAccount, setEditingAccount] = useState<TenantBankAccount | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<BankFormValues>({ defaultValues: bankDefaults() });

  useEffect(() => {
    reset(bankDefaults(editingAccount ?? undefined));
  }, [editingAccount, reset]);

  const selectedCurrency = useWatch({ control, name: 'currency' });
  const isDefault = useWatch({ control, name: 'isDefault' });
  const isSaving = createAccount.isPending || updateAccount.isPending;

  const onSubmit = (values: BankFormValues) => {
    const payload = toBankPayload(values);
    const callbacks = {
      onSuccess: () => {
        toast.success(editingAccount ? 'Bank account updated' : 'Bank account added');
        setEditingAccount(null);
        reset(bankDefaults());
      },
      onError: (error: unknown) => toast.error(errorMessage(error, 'Failed to save bank account')),
    };

    if (editingAccount) {
      updateAccount.mutate({ accountId: editingAccount.id, payload }, callbacks);
      return;
    }
    createAccount.mutate(payload, callbacks);
  };

  const handleDeactivate = (account: TenantBankAccount) => {
    deactivateAccount.mutate(account.id, {
      onSuccess: () => toast.success('Bank account deactivated'),
      onError: (error) => toast.error(errorMessage(error, 'Failed to deactivate bank account')),
    });
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-gray-100 p-2 text-gray-600">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Document Bank Accounts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Default active accounts are used as remittance details on official debit notes.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-gray-100 bg-gray-50 p-4"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FormField
            label="Bank Name"
            registration={register('bankName', { required: 'Bank name is required' })}
            error={errors.bankName}
          />
          <FormField label="Branch Name" registration={register('branchName')} />
          <FormField
            label="Account Name"
            registration={register('accountName', { required: 'Account name is required' })}
            error={errors.accountName}
          />
          <FormField
            label="Account Number"
            registration={register('accountNumber', { required: 'Account number is required' })}
            error={errors.accountNumber}
          />
          <SearchSelect
            label="Currency"
            options={currencyOptions}
            value={selectedCurrency}
            onChange={(value) => setValue('currency', value, { shouldDirty: true })}
          />
          <FormField label="SWIFT Code" registration={register('swiftCode')} />
          <FormField label="Sort Code" registration={register('sortCode')} />
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Default for currency</label>
            <div className="flex h-11.5 items-center gap-3 rounded-input border border-gray-300 bg-white px-4">
              <Toggle enabled={isDefault} onChange={(value) => setValue('isDefault', value)} />
              <span className="text-sm text-gray-600">{isDefault ? 'Default' : 'Not default'}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          {editingAccount && (
            <Button type="button" variant="ghost" onClick={() => setEditingAccount(null)}>
              Cancel Edit
            </Button>
          )}
          <Button type="submit" isLoading={isSaving} loadingText="Saving...">
            {editingAccount ? 'Update Bank Account' : 'Add Bank Account'}
          </Button>
        </div>
      </form>

      <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full min-w-190 text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Bank</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Loading bank accounts...
                </td>
              </tr>
            ) : bankAccounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No bank accounts added yet.
                </td>
              </tr>
            ) : (
              bankAccounts.map((account) => (
                <tr
                  key={account.id}
                  className={!account.isActive ? 'bg-gray-50 text-gray-400' : ''}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{account.bankName}</div>
                    <div className="text-xs text-gray-500">{account.branchName ?? 'No branch'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{account.accountName}</div>
                    <div className="text-xs text-gray-500">{account.accountNumber}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{account.currency}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {account.isDefault && account.isActive && (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                          Default
                        </span>
                      )}
                      <span
                        className={
                          account.isActive
                            ? 'rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700'
                            : 'rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500'
                        }
                      >
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingAccount(account)}
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      >
                        Edit
                      </Button>
                      {account.isActive && (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          isLoading={deactivateAccount.isPending}
                          onClick={() => handleDeactivate(account)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
