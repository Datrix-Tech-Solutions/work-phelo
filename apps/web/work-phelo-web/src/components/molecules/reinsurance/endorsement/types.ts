export interface EndorsementParticipantRow {
  id: string;
  participantId?: string;
  originalParticipantId?: string | null;
  counterpartyId: string;
  reinsurerName: string;
  originalShare: number;
  offeredShare: number;
  brokerageFee: number;
  isNew: boolean;
}

export interface EndorsementMarketPreviewState {
  counterpartyId: string;
  documentTitle: string;
  previewNotice: string;
  recipientName: string;
  relationship: string;
  offeredLinePercent: number;
  status: string;
  brokerageFee: number;
  previewFormat: 'OFFER_SLIP' | 'REVISED_CERTIFICATE';
}
