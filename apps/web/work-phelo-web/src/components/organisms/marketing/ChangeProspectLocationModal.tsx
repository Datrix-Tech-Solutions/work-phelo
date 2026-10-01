'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  CompanyLocationForm,
  CompanyLocationFields,
} from '@/components/molecules/marketing/CompanyLocationForm';
import { useUpdateProspect } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { ProspectDetailLocation } from '@/types/marketing';

interface Props {
  prospectId: string;
  prospectName: string;
  currentLocation: ProspectDetailLocation;
  isOpen: boolean;
  onClose: () => void;
}

export function ChangeProspectLocationModal({
  prospectId,
  prospectName,
  currentLocation,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const updateProspect = useUpdateProspect(prospectId);
  const [location, setLocation] = useState<CompanyLocationFields>({
    location: currentLocation.label,
    lat: Number(currentLocation.latitude),
    lng: Number(currentLocation.longitude),
  });

  const changed =
    location.lat !== Number(currentLocation.latitude) ||
    location.lng !== Number(currentLocation.longitude) ||
    location.location !== currentLocation.label;

  function handleSave() {
    if (location.lat == null || location.lng == null) return;
    updateProspect.mutate(
      { location: { label: location.location, latitude: location.lat, longitude: location.lng } },
      {
        onSuccess: () => {
          toast.success('Location updated');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update location')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Location"
      description={prospectName}
      width="max-w-3xl"
      height="max-h-[90vh]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={updateProspect.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!changed || location.lat == null || location.lng == null}
            isLoading={updateProspect.isPending}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <CompanyLocationForm values={location} onChange={setLocation} />
    </Modal>
  );
}
