import { RecruitmentQuestionType } from '../../prisma/generated/client';

/**
 * How each screening-question type is answered. Keyed by the Prisma enum, so adding a value to
 * `RecruitmentQuestionType` fails to compile until it is described here — nothing else in the
 * recruitment module branches on a specific type.
 */
export type RecruitmentQuestionBehaviour =
  /** Free text, stored in the answer's text field. */
  | { kind: 'text' }
  /** One or more of a list of options. `fixedOptions` are implied by the type (e.g. Yes / No). */
  | {
      kind: 'select';
      multiple: boolean;
      fixedOptions?: readonly string[];
    };

export const RECRUITMENT_QUESTION_BEHAVIOUR: Record<
  RecruitmentQuestionType,
  RecruitmentQuestionBehaviour
> = {
  SHORT_ANSWER: { kind: 'text' },
  PARAGRAPH: { kind: 'text' },
  YES_NO: { kind: 'select', multiple: false, fixedOptions: ['Yes', 'No'] },
  MULTIPLE_CHOICE: { kind: 'select', multiple: false },
  CHECKBOXES: { kind: 'select', multiple: true },
  DROPDOWN: { kind: 'select', multiple: false },
};

export const DEFAULT_RECRUITMENT_QUESTION_TYPE =
  RecruitmentQuestionType.SHORT_ANSWER;

export function questionBehaviour(
  type: RecruitmentQuestionType | null | undefined,
): RecruitmentQuestionBehaviour {
  return RECRUITMENT_QUESTION_BEHAVIOUR[
    type ?? DEFAULT_RECRUITMENT_QUESTION_TYPE
  ];
}
