import { Briefcase, Users, SlidersHorizontal } from 'lucide-react';
import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

/* ── Icons ── */
const JobOpeningsIcon = () => <Briefcase className="w-5 h-5" />;
const CandidatesIcon = () => <Users className="w-5 h-5" />;
const ConfigurationsIcon = () => <SlidersHorizontal className="w-5 h-5" />;

/**
 * Hiring's own sidebar (Job openings, Candidates, Configurations), same pattern as Payroll.
 * Each entry is gated by the matching recruitment read permission.
 */
export function useRecruitmentSidebarGroups(tenantSlug: string): {
  groups: NavGroup[];
  canViewJobOpenings: boolean;
  canViewCandidates: boolean;
  canViewConfigurations: boolean;
} {
  const canViewJobOpenings = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const canViewCandidates = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const canViewConfigurations = usePermission(Permission.READ_RECRUITMENT_STAGES);

  const base = `/${tenantSlug}/hr/recruitment`;

  const groups: NavGroup[] = [
    {
      label: 'Hiring',
      items: [
        {
          key: 'job-openings',
          label: 'Job Openings',
          icon: <JobOpeningsIcon />,
          href: `${base}/job-openings`,
          enabled: canViewJobOpenings,
          active: true,
        },
        {
          key: 'candidates',
          label: 'Candidates',
          icon: <CandidatesIcon />,
          href: `${base}/candidates`,
          enabled: canViewCandidates,
          active: true,
        },
      ],
    },
    {
      label: 'Configuration',
      items: [
        {
          key: 'configurations',
          label: 'Configurations',
          icon: <ConfigurationsIcon />,
          href: `${base}/configurations`,
          enabled: canViewConfigurations,
          active: true,
        },
      ],
    },
  ];

  return { groups, canViewJobOpenings, canViewCandidates, canViewConfigurations };
}
