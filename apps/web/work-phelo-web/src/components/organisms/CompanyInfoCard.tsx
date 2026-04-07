'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/SidePanel';
import { FormField } from '@/components/molecules/FormField';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SearchSelect } from '../atoms/SearchSelect';

/* ── Types ── */

interface AdminInfo {
  name: string;
  status: string;
  email: string;
}

interface CompanyInfoCardProps {
  id: string;
  name: string;
  slug: string;
  size?: string;
  industry?: string;
  location?: string;
  contact?: string;
  logoUrl?: string;
  admin?: AdminInfo;
}

interface EditCompanyForm {
  name: string;
  size?: string;
  industry?: string;
  country?: string;
  phone?: string;
}

interface AdminForm {
  firstName: string;
  lastName: string;
  email: string;
}

/* ── Constants ── */

const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1 – 10 employees' },
  { value: '11-50', label: '11 – 50 employees' },
  { value: '51-200', label: '51 – 200 employees' },
  { value: '201-500', label: '201 – 500 employees' },
  { value: '500+', label: '500+ employees' },
];

const INDUSTRY_OPTIONS = [
  { value: 'Agriculture', label: 'Agriculture' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Logistics', label: 'Logistics' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Other', label: 'Other' },
];

/* ── Sub-components ── */

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value ?? '—'}</span>
    </div>
  );
}

const EditIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

function CompanyAvatar({ name, logoUrl }: { name: string; logoUrl?: string }) {
  if (logoUrl) {
    return (
      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-sm">
        <Image
          src={logoUrl}
          alt={name}
          width={64}
          height={64}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className="w-16 h-16 rounded-full bg-[#0D2244] flex items-center justify-center text-white text-lg font-bold shadow-sm">
      {initials}
    </div>
  );
}

/* ── Main component ── */

export function CompanyInfoCard({
  id,
  name,
  slug,
  size: initialSize,
  industry: initialIndustry,
  location,
  contact,
  logoUrl,
  admin,
}: CompanyInfoCardProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const workspaceUrl = `${slug}`;

  const [industry, setIndustry] = useState(initialIndustry ?? '');

  const [size, setSize] = useState(initialSize ?? '');

  /* ── Edit company form ── */
  const {
    register: regEdit,
    handleSubmit: handleEdit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<EditCompanyForm>({
    defaultValues: { name, size, industry, country: location, phone: contact },
  });

  const { mutate: saveCompany, isPending: isSavingCompany } = useMutation({
    mutationFn: (data: EditCompanyForm) => api.patch(`/auth/tenants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      setEditOpen(false);
    },
  });

  /* ── Admin form ── */
  const adminNameParts = admin?.name?.split(' ') ?? [];
  const {
    register: regAdmin,
    handleSubmit: handleAdmin,
    formState: { errors: adminErrors },
  } = useForm<AdminForm>({
    defaultValues: {
      firstName: adminNameParts[0] ?? '',
      lastName: adminNameParts.slice(1).join(' ') ?? '',
      email: admin?.email ?? '',
    },
  });

  const { mutate: saveAdmin, isPending: isSavingAdmin } = useMutation({
    mutationFn: (data: AdminForm) => api.patch(`/auth/tenants/${id}/admin`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users', id] });
      setAdminOpen(false);
    },
  });

  return (
    <>
      <div className="border border-gray-200 rounded-card overflow-hidden bg-white flex flex-col h-full">
        <div className="flex flex-1 min-h-0">
          {/* Left column */}
          <div className="w-44 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col items-center justify-center py-6 px-4 gap-4">
            <CompanyAvatar name={name} logoUrl={logoUrl} />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{name}</p>
              <p className="text-xs text-gray-400 mt-1">{workspaceUrl}</p>
            </div>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-5 py-2 border border-gray-300 rounded-input text-sm text-gray-700 hover:bg-white transition-colors"
            >
              Edit <EditIcon />
            </button>
          </div>

          {/* Right column */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Company Information */}
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Company Information</h3>
              <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                <InfoField label="Company Size" value={size} />
                <InfoField label="Industry" value={industry} />
                <InfoField label="Location" value={location} />
                <InfoField label="Contact" value={contact} />
              </div>
            </div>

            {/* Administrator Information */}
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Administrator Information
              </h3>
              {admin ? (
                <div className="border border-gray-200 rounded-input overflow-hidden flex-1 flex flex-col">
                  <div className="grid grid-cols-3 gap-x-6 px-5 py-4 bg-gray-50 flex-1">
                    <InfoField label="Name" value={admin.name} />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-400">Status</span>
                      <StatusBadge status={admin.status} />
                    </div>
                    <InfoField label="Work Email" value={admin.email} />
                  </div>
                  <div className="flex justify-end px-5 py-3 border-t border-gray-100 bg-white">
                    <Button variant="outline" size="sm" onClick={() => setAdminOpen(true)}>
                      Update Admin
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-400">No administrator assigned.</p>
                  <Button variant="outline" size="sm" onClick={() => setAdminOpen(true)}>
                    Assign Admin
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Company Side Panel ── */}
      <SidePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Company"
        description="Update the company's information."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={isSavingCompany}
              loadingText="Saving…"
              onClick={handleEdit((data) => saveCompany(data))}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <FormField
          label="Company Name"
          registration={regEdit('name', { required: 'Company name is required' })}
          error={editErrors.name}
          placeholder="eg; Acme Corp Ltd"
        />
        <SearchSelect
          label="Company Size"
          placeholder="Select range"
          options={COMPANY_SIZE_OPTIONS}
          value={size}
          onChange={(v) => {
            setSize(v);
            setEditValue('size', v);
          }}
          error={editErrors.size?.message}
        />

        <SearchSelect
          label="Industry"
          placeholder="Select industry"
          options={INDUSTRY_OPTIONS}
          value={industry}
          onChange={(v) => {
            setIndustry(v);
            setEditValue('industry', v);
          }}
          error={editErrors.industry?.message}
        />
        <FormField
          label="Location"
          registration={regEdit('country')}
          error={editErrors.country}
          placeholder="eg; Accra, Ghana"
        />
        <PhoneInput
          label="Contact"
          placeholder="00 000 0000"
          onChange={(v) => setEditValue('phone', v)}
        />
      </SidePanel>

      {/* ── Assign / Update Admin Side Panel ── */}
      <SidePanel
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        title={admin ? 'Update Administrator' : 'Assign Administrator'}
        description={
          admin ? 'Update the admin account details.' : 'Assign an administrator to this company.'
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAdminOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={isSavingAdmin}
              loadingText="Saving…"
              onClick={handleAdmin((data) => saveAdmin(data))}
            >
              {admin ? 'Update Admin' : 'Assign Admin'}
            </Button>
          </div>
        }
      >
        <FormField
          label="First Name"
          registration={regAdmin('firstName', { required: 'First name is required' })}
          error={adminErrors.firstName}
          placeholder="eg; Daniel"
        />
        <FormField
          label="Last Name"
          registration={regAdmin('lastName', { required: 'Last name is required' })}
          error={adminErrors.lastName}
          placeholder="eg; Asante"
        />
        <FormField
          label="Email Address"
          registration={regAdmin('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
          })}
          error={adminErrors.email}
          type="email"
          placeholder="eg; daniel@acmecorp.com"
        />
      </SidePanel>
    </>
  );
}
