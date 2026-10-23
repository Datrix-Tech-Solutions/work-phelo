import { useAllEmployees, useMyProfile } from '@/hooks/hr/useEmployees';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

/**
 * Who can use Team Review. A manager reviews their own reports; people who run appraisals
 * (create, configure or finalize) can review anyone's submitted assessment.
 */
export function useIsManager() {
  const { data: me, isLoading: meLoading } = useMyProfile();
  const { data: employeeData, isLoading: employeesLoading } = useAllEmployees();
  const canCreate = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigure = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canFinalize = usePermission(Permission.FINALIZE_APPRAISAL);

  const reviewsAll = canCreate || canConfigure || canFinalize;
  const hasReports = !!me && (employeeData?.data ?? []).some((e) => e.managerId === me.id);
  return {
    isManager: hasReports || reviewsAll,
    reviewsAll,
    isLoading: meLoading || employeesLoading,
  };
}
