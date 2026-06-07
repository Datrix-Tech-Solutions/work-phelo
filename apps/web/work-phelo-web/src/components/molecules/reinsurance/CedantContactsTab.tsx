'use client';

import { DetailField } from '@/components/atoms/DetailField';
import { CounterpartyContact } from '@/types/reinsurance';

interface CedantContactsTabProps {
  contacts: CounterpartyContact[];
}

export function CedantContactsTab({ contacts }: CedantContactsTabProps) {
  const primaryContact = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const additionalContacts = contacts.filter((c) => !c.isPrimary);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-6">
      {primaryContact ? (
        <div className="flex flex-col gap-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Primary Contact
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
            <DetailField label="Name" value={primaryContact.fullName} />
            {primaryContact.jobTitle && (
              <DetailField label="Job Title" value={primaryContact.jobTitle} />
            )}
            {primaryContact.email && <DetailField label="Email" value={primaryContact.email} />}
            {primaryContact.phone && <DetailField label="Phone" value={primaryContact.phone} />}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">No contacts on record.</p>
      )}

      {additionalContacts.length > 0 && (
        <div className="flex flex-col gap-4 pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Additional Contacts
          </span>
          {additionalContacts.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5"
            >
              <DetailField label="Name" value={c.fullName} />
              {c.jobTitle && <DetailField label="Job Title" value={c.jobTitle} />}
              {c.email && <DetailField label="Email" value={c.email} />}
              {c.phone && <DetailField label="Phone" value={c.phone} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
