export const DEFAULT_PROJECT_LABEL = 'Project';

export interface ModuleLabels {
  /** "Case" */
  singular: string;
  /** "Cases" */
  plural: string;
  /** "case" — for use inside a sentence */
  singularLower: string;
  /** "cases" */
  pluralLower: string;
  /** "Case Management" — "Management" is fixed, only the name varies */
  management: string;
}

/** Builds every form of a company-chosen name. Plural is the name with an "s" added. */
export function buildModuleLabels(name: string | undefined | null, fallback: string): ModuleLabels {
  const singular = name?.trim() || fallback;
  const plural = `${singular}s`;
  return {
    singular,
    plural,
    singularLower: singular.toLowerCase(),
    pluralLower: plural.toLowerCase(),
    management: `${singular} Management`,
  };
}
