'use client';

import { useMemo } from 'react';
import { DocumentManagerPanel } from '@/components/organisms/hr/documents/DocumentManagerPanel';
import { inferFileKind, type MyDocument } from '@/components/organisms/hr/documents/types';
import { candidateFullName } from './candidateUtils';
import type { RecruitmentCandidateDetail } from '@/types/recruitment';

function mimeTypeFor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

function toDocument(
  candidate: RecruitmentCandidateDetail,
  kind: 'resume' | 'coverLetter',
): MyDocument | null {
  const url = kind === 'resume' ? candidate.resumeUrl : candidate.coverLetterUrl;
  if (!url) return null;
  const fallback = kind === 'resume' ? 'Resume.pdf' : 'Cover letter.pdf';
  const name =
    (kind === 'resume' ? candidate.resumeFileName : candidate.coverLetterFileName) || fallback;
  const mimeType = mimeTypeFor(name);
  return {
    id: `${candidate.id}-${kind}`,
    name,
    fileKind: inferFileKind(mimeType),
    mimeType,
    // The application only stores a link, so the file's size isn't known.
    sizeBytes: 0,
    uploadedAt: candidate.submittedAt ?? candidate.appliedAt,
    uploadedBy: candidateFullName(candidate),
    category: kind === 'resume' ? 'Resume' : 'Cover Letter',
    previewUrl: url,
  };
}

/** The candidate's submitted files, shown like the employee documents tab but as a grid only. */
export function CandidateDocumentsTab({ candidate }: { candidate: RecruitmentCandidateDetail }) {
  const documents = useMemo(
    () =>
      (['resume', 'coverLetter'] as const)
        .map((kind) => toDocument(candidate, kind))
        .filter((d): d is MyDocument => d !== null),
    [candidate],
  );

  return (
    <DocumentManagerPanel documents={documents} allowUpload={false} allowDelete={false} gridOnly />
  );
}
