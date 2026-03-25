import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../Functions/company_functions/onboarding_function/user_state.dart';
import '../../../Functions/company_functions/permissions/app_module.dart';
import '../../../Functions/company_functions/permissions/roles_state.dart';

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
  final AppModule? requiredModule;

  const NavDestination({
    required this.icon,
    required this.title,
    required this.pageIndex,
    required this.page,
    this.requiredModule,
  });
}

Set<AppModule> resolveUserModules(AppUser currentUser, WidgetRef ref) {
  // platform_owner and super_admin always get everything
  if (currentUser.isPlatformOwner || currentUser.isSuperAdmin) {
    return AppModule.values.toSet();
  }

  final userModel = ref
      .watch(usersByTenantProvider(currentUser.tenantSlug))
      .where((u) => u.email == currentUser.email)
      .firstOrNull;

  if (userModel == null || userModel.systemRole.isEmpty) return {};

  final roles = ref.watch(rolesByTenantProvider(currentUser.tenantSlug));

  // Union all modules from every role the user holds
  return userModel.systemRole.fold(<AppModule>{}, (acc, roleId) {
    final role = roles.where((r) => r.id == roleId).firstOrNull;
    if (role == null) return acc;
    return acc..addAll(role.modules);
  });
}
