'use client';

import { useCallback } from 'react';
import { ImportRecordsDialog } from '@/components/organisms/marketing/ImportRecordsDialog';
import { useImportReferences } from '@/components/organisms/marketing/useImportReferences';
import { useCreateClient } from '@/hooks/marketing/useClients';
import { clientImportKind, downloadClientTemplate } from '@/lib/marketing-import/clients';
import { readDrafts, validateDraft } from '@/lib/marketing-import/records';
import { locatePlaces } from '@/lib/marketing-import/shared';
import type { CreateClientPayload } from '@/types/marketing';

export function ImportClientsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { refs, ready, prepare } = useImportReferences(false);
  const { mutateAsync } = useCreateClient();
  const country = refs.country;
  const locate = useCallback((places: string[]) => locatePlaces(places, country), [country]);

  return (
    <ImportRecordsDialog<CreateClientPayload>
      isOpen={isOpen}
      onClose={onClose}
      noun="client"
      ready={ready}
      read={(file) => readDrafts(file, clientImportKind)}
      validate={(draft, locations) => validateDraft(draft, clientImportKind, refs, locations)}
      locate={locate}
      downloadTemplate={() => downloadClientTemplate()}
      prepare={prepare}
      create={mutateAsync}
    />
  );
}
