'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Area } from 'react-easy-crop';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AvatarUploader } from '@/components/molecules/hr/employees/AvatarUploader';
import { AvatarCropper } from '@/components/molecules/hr/employees/AvatarCropper';
import { getCroppedImageFile } from '@/lib/cropImage';

interface ProfilePhotoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  currentUrl?: string | null;
  /** `file` = new photo to upload, `null` = remove the current photo. */
  onSave: (file: File | null) => void;
  isSaving?: boolean;
  /** Show the "Remove photo" action (there is no remove endpoint yet). */
  canRemove?: boolean;
}

export function ProfilePhotoDialog({
  isOpen,
  onClose,
  name,
  currentUrl,
  onSave,
  isSaving = false,
  canRemove = false,
}: ProfilePhotoDialogProps) {
  // This dialog is mounted only while open (see caller), so state starts fresh
  // each time without a reset effect.
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [remove, setRemove] = useState(false);
  const [isCropping, setIsCropping] = useState(false);

  const rawImageUrl = useMemo(() => (rawFile ? URL.createObjectURL(rawFile) : null), [rawFile]);
  useEffect(() => {
    return () => {
      if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    };
  }, [rawImageUrl]);

  const dirty = rawFile !== null || remove;
  const busy = isSaving || isCropping;

  const handlePick = (file: File | null) => {
    setRawFile(file);
    setCroppedAreaPixels(null);
    if (file) setRemove(false);
  };

  const handleSave = async () => {
    if (remove) {
      onSave(null);
      return;
    }
    if (!rawFile || !rawImageUrl || !croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const cropped = await getCroppedImageFile(
        rawImageUrl,
        croppedAreaPixels,
        rawFile.name,
        rawFile.type,
      );
      onSave(cropped);
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile photo"
      description={
        rawFile
          ? 'Reposition and zoom, then save.'
          : 'Upload a picture so teammates can recognise you.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || (rawFile !== null && !croppedAreaPixels)}
            isLoading={busy}
            loadingText="Saving…"
          >
            Save photo
          </Button>
        </>
      }
    >
      {rawFile && rawImageUrl ? (
        <div className="flex flex-col gap-3 pt-4">
          <AvatarCropper imageSrc={rawImageUrl} onCropComplete={setCroppedAreaPixels} />
          <button
            type="button"
            onClick={() => handlePick(null)}
            disabled={busy}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors self-center disabled:opacity-50"
          >
            Choose a different photo
          </button>
        </div>
      ) : (
        <AvatarUploader
          name={name}
          currentUrl={currentUrl}
          file={null}
          onFileChange={handlePick}
          markedForRemoval={remove}
          onRemove={
            canRemove
              ? () => {
                  setRawFile(null);
                  setRemove(true);
                }
              : undefined
          }
          disabled={isSaving}
        />
      )}
    </Modal>
  );
}
