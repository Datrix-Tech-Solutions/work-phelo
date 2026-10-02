import { GLAccountCategory } from '@/types/accounting';


export type GLAccountCategoryChipColor =
  | 'red'
  | 'green'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'teal'
  | 'gray';

export const GL_ACCOUNT_CATEGORY_CHIP_COLOR: Record<GLAccountCategory, GLAccountCategoryChipColor> =
  {
    ASSET: 'blue',
    LIABILITY: 'red',
    EQUITY: 'purple',
    REVENUE: 'green',
    EXPENSE: 'amber',
  };
