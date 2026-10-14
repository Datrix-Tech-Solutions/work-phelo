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
