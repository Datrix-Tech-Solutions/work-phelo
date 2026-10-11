'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  useDeleteArchivedEntries,
  useDeleteArchivedEntry,
} from '@/hooks/accounting/useChangePosted';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { ArchiveKind } from '@/types/accounting';

export interface DeleteArchivedTarget {
  kind: ArchiveKind;
  id: string;
  /** What is being deleted, e.g. "Invoice INV26-00001". */
  subject: string;
}

interface Props {
  /** One entry, or several chosen in the archive table. Nothing open when empty or null. */
  target: DeleteArchivedTarget | DeleteArchivedTarget[] | null;
  onClose: () => void;
  /** Called once the entries are gone, so a panel showing one can close or a selection clear. */
  onDeleted?: () => void;
}

/** Confirms deleting archived entries. They leave the archive for good, whatever their period;
 *  their records and audit trail stay in the books' history. */
export function DeleteArchivedEntryModal({ target, onClose, onDeleted }: Props) {
  const toast = useToast();
  const removeOne = useDeleteArchivedEntry();
  const removeMany = useDeleteArchivedEntries();

  const targets = Array.isArray(target) ? target : target ? [target] : [];
  const many = targets.length > 1;
  const subject = many
    ? `${targets.length} archived entries`
    : (targets[0]?.subject ?? 'This entry');
  const isPending = removeOne.isPending || removeMany.isPending;

  const handleDelete = async () => {
    if (targets.length === 0) return;
    try {
      if (many) {
        const { deleted, skipped } = await removeMany.mutateAsync(
          targets.map(({ kind, id }) => ({ kind, id })),
        );
        toast.success(
          skipped > 0
            ? `${deleted} deleted from the archive. ${skipped} were no longer there.`
            : `${deleted} deleted from the archive.`,
        );
      } else {
        await removeOne.mutateAsync({ kind: targets[0].kind, id: targets[0].id });
        toast.success(`${subject} deleted from the archive.`);
      }
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(extractError(error, 'Failed to delete'));
    }
  };

  return (
    <Modal
      isOpen={targets.length > 0}
      onClose={onClose}
      title="Delete from Archive"
      description={`${subject} will be removed from the archive and can no longer be restored. This cannot be undone from here.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isPending}
            loadingText="Deleting…"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-600">
        {many ? 'They stay' : 'It stays'} out of every balance and report, as{' '}
        {many ? 'they do' : 'it does'} now. Only {many ? 'their place' : 'its place'} in the archive
        goes.
      </p>
    </Modal>
  );
}
