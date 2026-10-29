import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const MAX_RECRUITMENT_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function validateRecruitmentDocument(file?: Express.Multer.File) {
  if (!file?.buffer?.length)
    throw new BadRequestException('A document file is required');
  if (file.buffer.length > MAX_RECRUITMENT_DOCUMENT_BYTES) {
    throw new PayloadTooLargeException('Document must not exceed 15 MiB');
  }
  const baseName = file.originalname.replace(/\\/g, '/').split('/').pop() ?? '';
  const extension = baseName.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = MIME_TYPES[extension];
  if (!mimeType || file.mimetype !== mimeType) {
    throw new BadRequestException(
      'Only PDF, DOC and DOCX documents with matching MIME types are supported',
    );
  }
  const body = file.buffer;
  const matches =
    extension === 'pdf'
      ? body.subarray(0, 5).equals(Buffer.from('%PDF-'))
      : extension === 'doc'
        ? body.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) &&
          body.includes(Buffer.from('WordDocument', 'utf16le'))
        : isWordOpenXml(body);
  if (!matches)
    throw new BadRequestException(
      'Document contents do not match the selected file type',
    );
  const stem =
    baseName
      .slice(0, -(extension.length + 1))
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120) || 'document';
  return { body, mimeType, originalFileName: `${stem}.${extension}` };
}

// Inspect ZIP directory names without expanding untrusted compressed content.
function isWordOpenXml(body: Buffer): boolean {
  if (body.length < 4) return false;
  if (body.readUInt32LE(0) !== 0x04034b50) return false;
  const end = body.lastIndexOf(Buffer.from('504b0506', 'hex'));
  if (end < 0 || end + 22 > body.length) return false;
  const count = body.readUInt16LE(end + 10);
  let offset = body.readUInt32LE(end + 16);
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || body.readUInt32LE(offset) !== 0x02014b50)
      return false;
    const nameLength = body.readUInt16LE(offset + 28);
    const next =
      offset +
      46 +
      nameLength +
      body.readUInt16LE(offset + 30) +
      body.readUInt16LE(offset + 32);
    if (next > end || (body.readUInt16LE(offset + 8) & 1) !== 0) return false;
    names.add(
      body.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'),
    );
    offset = next;
  }
  return (
    names.has('[Content_Types].xml') &&
    names.has('word/document.xml') &&
    ![...names].some((name) => /vbaProject\.bin$/i.test(name))
  );
}

export const MAX_RECRUITMENT_TEXT_CHARS = 10000;

/** Typed document content (a cover letter) as a plain-text file. */
export function validateRecruitmentText(text?: string) {
  const trimmed = text?.trim();
  if (!trimmed) throw new BadRequestException('Cover letter text is required');
  if (trimmed.length > MAX_RECRUITMENT_TEXT_CHARS) {
    throw new BadRequestException(
      `Cover letter must not exceed ${MAX_RECRUITMENT_TEXT_CHARS} characters`,
    );
  }
  return {
    body: Buffer.from(trimmed, 'utf8'),
    mimeType: 'text/plain',
    originalFileName: 'Cover_letter.txt',
  };
}
