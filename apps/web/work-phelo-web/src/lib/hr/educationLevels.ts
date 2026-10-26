/** Education level codes the application API stores, with their display labels. */
const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  NO_FORMAL_EDUCATION: 'No Formal Education',
  BASIC_EDUCATION: 'Basic Education (Primary)',
  JHS: 'Junior High School (JHS / BECE)',
  SHS: 'Senior High School (SHS / WASSCE)',
  TVET: 'Technical or Vocational Education (TVET)',
  CERTIFICATE: 'Certificate',
  DIPLOMA: 'Diploma',
  HND: 'Higher National Diploma (HND)',
  BACHELORS: "Bachelor's Degree",
  POSTGRADUATE_DIPLOMA: 'Postgraduate Diploma',
  MASTERS: "Master's Degree",
  DOCTORATE: 'Doctorate (PhD)',
};

export function educationLevelLabel(code: string): string {
  return EDUCATION_LEVEL_LABELS[code] ?? code;
}

/**
 * Maps what an applicant wrote as their highest education (a code, a label or free text such as
 * "Bachelor Degree" or "BSc") to a ladder code. Null when it cannot be recognised.
 */
export function educationLevelCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const asCode = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (asCode in EDUCATION_LEVEL_LABELS) return asCode;
  const text = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const rules: Array<[RegExp, string]> = [
    [/\b(phd|dphil|doctorate|doctoral)\b/, 'DOCTORATE'],
    [/\b(postgraduate|pgd)\b.*\b(diploma|pgd)\b|\bpgd\b/, 'POSTGRADUATE_DIPLOMA'],
    [/\b(masters?|msc|mba|mphil|ma)\b/, 'MASTERS'],
    [/\b(bachelors?|bsc|ba|beng|bed|first degree)\b/, 'BACHELORS'],
    [/\b(hnd|higher national diploma)\b/, 'HND'],
    [/\bdiploma\b/, 'DIPLOMA'],
    [/\b(tvet|technical|vocational)\b/, 'TVET'],
    [/\bcertificate\b/, 'CERTIFICATE'],
    [/\b(shs|wassce|ssce|senior high|secondary)\b/, 'SHS'],
    [/\b(jhs|bece|junior high)\b/, 'JHS'],
    [/\b(primary|basic)\b/, 'BASIC_EDUCATION'],
    [/\b(none|no formal)\b/, 'NO_FORMAL_EDUCATION'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** Position on the education ladder (ascending); -1 when the code or wording is not recognised. */
export function educationLevelRank(value: string): number {
  const code = educationLevelCode(value);
  return code ? Object.keys(EDUCATION_LEVEL_LABELS).indexOf(code) : -1;
}
