/** Builds a "Document Name_Policy Number_Insured Name" filename for print-to-PDF documents. */
export function buildDocumentFileName(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => !!part && part.trim().length > 0)
    .map((part) => part.trim().replace(/[\\/:*?"<>|]/g, ''))
    .join('_');
}
