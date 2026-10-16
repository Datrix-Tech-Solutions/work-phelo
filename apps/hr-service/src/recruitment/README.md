# Applicant documents

Recruitment reuses HR's `EmployeeDocumentStorageService`: private S3 objects or
Cloudinary authenticated/raw assets. This is the existing backend multipart
upload convention, not a new direct-upload subsystem. Provider configuration is
the existing `AUTH_TENANT_ASSET_*`, `CLOUDINARY_*` and AWS SDK credential chain.
S3 buckets must block public access. No recruitment-specific credentials are added.

External routes use the gateway prefix `/api/v1/hr`:

- `POST /recruitment/public/applications/:applicationId/documents/upload`
  accepts multipart `type=RESUME|COVER_LETTER|OTHER` and `file`.
- `GET /recruitment/public/applications/:applicationId/documents` lists active metadata.
- `DELETE /recruitment/public/applications/:applicationId/documents/:documentId`
  retires metadata and attempts object deletion, returning 204.
- `GET /recruitment/candidates/:candidateId/documents` returns managed metadata,
  links and explicitly marked legacy external references.
- `GET /recruitment/candidates/:candidateId/documents/:documentId/download`
  returns `{ readUrl, expiresAt }`, using the existing TTL (120 seconds by default,
  bounded at 900 seconds).

Public routes require the matching `x-application-access-token` and a DRAFT
application with an open, unexpired vacancy. Recruiter routes require authenticated
HR access, candidate VIEW permission, tenant ownership and a SUBMITTED application.
Public routes cannot change submitted documents. Storage keys are never returned.

PDF, DOC and DOCX are limited to 15 MiB per file. Validation checks the extension,
declared MIME type and content signature (including Word container markers).
Encrypted/macro-enabled DOCX containers are rejected. Names are sanitized and all
object paths are generated on the server beneath tenant/application/document IDs.
Portfolio and GitHub remain links. There is no antivirus service in the repository;
signature checks are not a malware scan, and files remain private.

An upload is ACTIVE only after validation and successful storage, so no separate
confirmation endpoint exists. Resume/cover-letter replacement retires the previous
metadata and creates the new active row in one transaction. A row lock shared with
submission/deletion prevents a late upload from modifying a submitted application.
The partial unique index also enforces one active resume/cover letter. Storage I/O
is outside database transactions. Failed metadata writes attempt new-object cleanup;
successful replacement/deletion attempts old-object cleanup. Failed cleanup is logged
by document ID. Orphan reconciliation/retention and malware scanning remain follow-ups.

Existing `details.documents.resume` and `.coverLetter` flags drive review/submission
requirements. Only active managed records satisfy these requirements. Legacy external
URL fields are preserved without inventing managed ownership; existing submitted
references stay visible, but cannot be signed by the managed download route.

The additive migration is intentionally not executed by this implementation task.
Provider tests are mocked; a private upload/read smoke test is needed before rollout.
