import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import '../../../work_phelo_funtions/work_phelo_companies/employee_permission_funtions/company_modules_model.dart';
import '../../../work_phelo_funtions/work_phelo_companies/employee_permission_funtions/permissions_roles_state.dart';
import '../../../work_phelo_funtions/work_phelo_users/user_model.dart';

sealed class NavItem {
  const NavItem();
}

class NavSection extends NavItem {
  final String title;
  const NavSection(this.title);
}

class NavDestination extends NavItem {
  final IconData icon;
  final String title;
  final int pageIndex;
  final Widget page;
  final PermissionModule? requiredModule;

  const NavDestination({
    required this.icon,
    required this.title,
    required this.pageIndex,
    required this.page,
    this.requiredModule,
  });
}

Set<PermissionModule> resolveUserModules(AppUserModel currentUser, WidgetRef ref) {
  // platform_owner and super_admin always get everything
  if (currentUser.isPlatformOwner || currentUser.isSuperAdmin) {
    return PermissionModule.values.toSet();
  }

  final userModel = ref
      .watch(usersByTenantProvider(currentUser.tenantSlug))
      .where((u) => u.email == currentUser.email)
      .firstOrNull;

  if (userModel == null || userModel.systemRole.isEmpty) return {};

  final roles = ref.watch(rolesByTenantProvider(currentUser.tenantSlug));

  // Union all modules from every role the user holds
  return userModel.systemRole.fold(<PermissionModule>{}, (acc, roleId) {
    final role = roles.where((r) => r.id == roleId).firstOrNull;
    if (role == null) return acc;
    return acc..addAll(role.modules);
  });
}
