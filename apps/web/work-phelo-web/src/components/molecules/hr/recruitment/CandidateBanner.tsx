'use client';

import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import {
  ProfileBannerTabs,
  type ProfileBannerTab,
} from '@/components/molecules/hr/employees/ProfileBannerTabs';
import { candidateFullName, stageVariant } from './candidateUtils';
import type { RecruitmentCandidate } from '@/types/recruitment';

interface Props {
  candidate: RecruitmentCandidate;
  color?: string | null;
  canChangeStage: boolean;
  canScheduleInterview: boolean;
  onChangeStage: () => void;
  onScheduleInterview: () => void;
  tabs: ProfileBannerTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

/** Same banner as the employee profile, with the candidate's role and stage in place of HR actions. */
export function CandidateBanner({
  candidate,
  color,
  canChangeStage,
  canScheduleInterview,
  onChangeStage,
  onScheduleInterview,
  tabs,
  activeTab,
  onTabChange,
}: Props) {
  const name = candidateFullName(candidate);

  return (
    <div
      className="relative w-full rounded-card rounded-t-none bg-brand"
      style={color ? { background: color } : undefined}
    >
      <div className="relative flex items-end gap-4 px-5 pt-13 pb-3 sm:px-6 sm:pt-17 lg:pt-20">
        <div className="relative w-36 shrink-0 self-stretch">
          <div className="absolute left-0 bottom-0 z-10 translate-y-7">
            <Avatar name={name} size={144} shape="rounded" className="ring-2 ring-white/20" />
          </div>
        </div>

        <div className="flex-1 min-w-0 self-stretch flex flex-col">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base font-bold text-white truncate">{name}</h1>
              {candidate.currentStage && (
                // The badge is an outline pill, so it gets a white backing to read on the blue banner.
                <span className="inline-flex rounded-full bg-white">
                  <Badge
                    label={candidate.currentStage.name}
                    variant={stageVariant(candidate.currentStage.name)}
                  />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
              {candidate.vacancy.title && (
                <span className="text-xs text-white/80">Applied for {candidate.vacancy.title}</span>
              )}
              {candidate.email && (
                <>
                  <span className="text-white/30 text-xs">·</span>
                  <span className="text-xs text-white/60">{candidate.email}</span>
                </>
              )}
              {candidate.phone && (
                <>
                  <span className="text-white/30 text-xs">·</span>
                  <span className="text-xs text-white/60">{candidate.phone}</span>
                </>
              )}
            </div>
          </div>
          <ProfileBannerTabs
            className="mt-auto translate-y-3 pt-2"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            accentColor={color}
            maxInline={4}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {canScheduleInterview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onScheduleInterview}
              className="text-white border-white/40 bg-transparent hover:bg-white/10"
            >
              Schedule Interview
            </Button>
          )}
          {canChangeStage && (
            <Button size="sm" onClick={onChangeStage}>
              Change Stage
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
