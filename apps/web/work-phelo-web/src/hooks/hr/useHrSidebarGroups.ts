import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { HR_NAV_GROUPS, HR_TAB_KEYS } from '@/config/hr-nav';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { useIsManager } from '@/hooks/hr/useIsManager';
import { Permission } from '@/lib/permissionMap';
import { getActiveOperationsFeature } from '@/config/operations-features';

/**
 * Which HR nav entries the current user can reach, keyed by nav item key. Shared by the sidebar and
 * the top-nav tabs so both agree on what shows.
 */
export function useHrNavAccess(): Record<string, boolean> {
  const user = useAuthStore((s) => s.user);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  const canReadEmployees = usePermission(Permission.READ_EMPLOYEES);
  const canViewHrDashboard = usePermission(Permission.VIEW_HR_DASHBOARD);
  const canViewHrReports = usePermission(Permission.VIEW_HR_REPORTS);
  const canReadOwnProfile = usePermission(Permission.READ_OWN_PROFILE);
  // Operations' landing page (reinsurance dashboard) redirects back to HR
  // for anyone lacking this permission — so a user without it shouldn't see
  // "Operations" listed here in the first place, even if the tenant has the
  // module enabled for other users.
  const canViewReinsuranceDashboard = usePermission(Permission.VIEW_REINSURANCE_DASHBOARD);
  // Payroll's own sidebar only has Manage/Contributions (RUN_PAYROLL) and
  // Approve/History (RUN_PAYROLL or APPROVE_PAYROLL) — so the "Payroll" entry
  // here should only show if at least one of those pages is actually
  // reachable, not for permissions (like READ_OWN_PAYSLIP) that don't unlock
  // anything inside Payroll's own section anymore.
  const canRunPayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canAccessPayroll = canRunPayroll || canApprovePayroll;
  // Same idea for Appraisal — only show it if HR/Admin Review, Team Review, or
  // Configuration is actually reachable inside its own sidebar.
  const canCreateAppraisal = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canFinalizeAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);
  const canViewAppraisals = canCreateAppraisal || canConfigureAppraisal || canFinalizeAppraisal;
  const { isManager: isAppraisalManager } = useIsManager();
  const canAccessAppraisal = canViewAppraisals || isAppraisalManager;
  // Leave section: Requests (APPROVE_LEAVE or tenant admin) + config (MANAGE_LEAVE_TYPES).
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);
  const canAccessLeave = canApproveLeave || isTenantAdmin || canManageLeaveTypes;

  // Recruitment is an HR section (not a separate tenant module), so it's gated by its own
  // permissions rather than moduleConfig — which the backend still reports as locked.
  const canReadRecruitmentVacancies = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const canReadRecruitmentCandidates = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const canAccessRecruitment = canReadRecruitmentVacancies || canReadRecruitmentCandidates;

  const canReadAssets = usePermission(Permission.READ_ASSETS);

  const moduleConfig = user?.moduleConfig ?? {};
  const operationsFeature = getActiveOperationsFeature(user?.featureConfig);

  const navAccess: Record<string, boolean> = {
    // The dashboard is a self-service "my" view (my leave, my payslips, clock in/out) —
    // not relevant for a tenant admin, so it's hidden for that role.
    dashboard: !isTenantAdmin,
    // The organisation dashboard needs its own permission.
    'hr-dashboard': canViewHrDashboard,
    // Reports has its own permission, separate from the dashboard's.
    reports: canViewHrReports,
    profile: canReadOwnProfile,
    employees: canReadEmployees || canReadOwnProfile,
    leave: canAccessLeave,
    payroll: canAccessPayroll,
    appraisal: canAccessAppraisal,
    // Projects is a per-tenant feature flag rather than a permission.
    projects: !!user?.featureConfig?.hr?.projects,
    accounting: moduleConfig.accounting ?? false,
    // Reinsurance is gated by its dashboard permission; other operations features have none yet.
    operations:
      (moduleConfig.operations ?? false) &&
      !!operationsFeature &&
      (operationsFeature.key !== 'reinsurance' || canViewReinsuranceDashboard),
    marketing: moduleConfig.marketing ?? false,
    recruitment: canAccessRecruitment,
    assets: canReadAssets,
  };

  return navAccess;
}

/**
 * Builds HR's sidebar groups (Home, Profile, My Team, Modules), resolved to
 * real tenant-scoped hrefs and filtered by permission/enabled-module access.
 *
 * `currentModuleKey` is whichever module the sidebar is being rendered for —
 * `'hr'` when it's HR's own full sidebar, or the module you're currently
 * browsing (e.g. `'accounting'`) when this is the parked HR rail shown
 * alongside another module's sidebar. Either way, the module matching
 * `currentModuleKey` is left out of the Modules list, since you're already
 * looking at it.
 */
export function useHrSidebarGroups(tenantSlug: string, currentModuleKey: string): NavGroup[] {
  const navAccess = useHrNavAccess();
  const operationsFeature = getActiveOperationsFeature(useAuthStore((s) => s.user?.featureConfig));

  const resolveHref = (href: string) =>
    href.startsWith('/') ? `/${tenantSlug}${href}` : `/${tenantSlug}/hr${href ? `/${href}` : ''}`;

  // Reports and HR Settings belong to HR itself, so the parked rail in another module leaves the
  // Management group out entirely.
  const isHrChrome = currentModuleKey === 'hr';

  return HR_NAV_GROUPS.filter((group) => isHrChrome || group.label !== 'Management').map(
    (group) => ({
      ...group,
      items: group.items
        .filter((item) => item.key !== currentModuleKey)
        // The section entries (Hiring, Payroll, etc.) are kept out of the sidebar and rail.
        .filter((item) => !HR_TAB_KEYS.includes(item.key))
        .map((item) => ({
          ...item,
          // The operations link is named after, and shows the icon of, the selected feature.
          ...(item.key === 'operations' && operationsFeature
            ? { label: operationsFeature.navLabel, icon: operationsFeature.navIcon }
            : {}),
          href: resolveHref(item.href),
          enabled: item.enabled !== false && (navAccess[item.key] ?? true),
          active: true,
        })),
    }),
  );
}
