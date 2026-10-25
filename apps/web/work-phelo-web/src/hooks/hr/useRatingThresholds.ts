import { useMemo } from 'react';
import { useAppraisalSettings } from '@/hooks/hr/useAppraisals';
import { DEFAULT_THRESHOLDS, type RatingThresholds } from '@/lib/appraisalAssessments';

/** The rating cut-offs HR saved under appraisal settings, or the defaults while they load or can't be read. */
export function useRatingThresholds(): RatingThresholds {
  const { data } = useAppraisalSettings();
  return useMemo(
    () =>
      data
        ? {
            outstanding: data.outstandingThreshold,
            veryGood: data.veryGoodThreshold,
            good: data.goodThreshold,
            satisfactory: data.satisfactoryThreshold,
          }
        : DEFAULT_THRESHOLDS,
    [data],
  );
}
