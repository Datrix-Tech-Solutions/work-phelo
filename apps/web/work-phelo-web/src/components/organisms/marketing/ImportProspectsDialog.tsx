'use client';

import { useCallback, useMemo } from 'react';
import { ImportRecordsDialog } from '@/components/organisms/marketing/ImportRecordsDialog';
import { useImportReferences } from '@/components/organisms/marketing/useImportReferences';
import { useCreateProspect } from '@/hooks/marketing/useProspects';
import { downloadProspectTemplate, prospectImportKind } from '@/lib/marketing-import/prospects';
import { readDrafts, validateDraft } from '@/lib/marketing-import/records';
import { locatePlaces } from '@/lib/marketing-import/shared';
import type { CreateProspectPayload } from '@/types/marketing';

export function ImportProspectsDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { refs, ready, prepare } = useImportReferences(true);
  const { mutateAsync } = useCreateProspect();
  const kind = useMemo(() => prospectImportKind(refs), [refs]);
  const country = refs.country;
  const locate = useCallback((places: string[]) => locatePlaces(places, country), [country]);

  return (
    <ImportRecordsDialog<CreateProspectPayload>
      isOpen={isOpen}
      onClose={onClose}
      noun="prospect"
      ready={ready}
      read={(file) => readDrafts(file, kind)}
      validate={(draft, locations) => validateDraft(draft, kind, refs, locations)}
      locate={locate}
      downloadTemplate={() => downloadProspectTemplate(refs)}
      prepare={prepare}
      create={mutateAsync}
    />
  );
}
