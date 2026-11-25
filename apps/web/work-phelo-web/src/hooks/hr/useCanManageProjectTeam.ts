import { useMyProfile, usePermission, useProject } from '@/hooks';
import { Permission } from '@/lib/permissionMap';

/** Whether the person may assign and remove a project's members and set their rates. */
export function useCanManageProjectTeam(projectId: string) {
  const canManageProjects = usePermission(Permission.ASSIGN_PROJECT);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const isProjectManager = !!(
    project?.managerId &&
    myProfile?.id &&
    project.managerId === myProfile.id
  );
  return canManageProjects || isProjectManager;
}
