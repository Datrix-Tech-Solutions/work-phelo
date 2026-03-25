import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_module.dart';
import 'roles_state.dart';

void seedRoles(WidgetRef ref, String tenantSlug) {
  final predefined = [
    AppRole(
      id: 'admin',
      name: 'Admin',
      description: 'Full access to all modules',
      modules: AppModule.values.toSet(),
      color: const Color(0xFF534AB7),
      isLocked: true,
      tenantSlug: tenantSlug,
    ),
    AppRole(
      id: 'hr_manager',
      name: 'HR Manager',
      description: 'Full access to HR module only',
      modules: {
        AppModule.onboarding,
        AppModule.offboarding,
        AppModule.leaveManagement,
        AppModule.appraisal,
      },
      color: const Color(0xFF1D9E75),
      isLocked: true,
      tenantSlug: tenantSlug,
    ),
    AppRole(
      id: 'marketing_manager',
      name: 'Marketing Manager',
      description: 'Full access to marketing module only',
      modules: {AppModule.marketingModule},
      color: const Color(0xFFD4537E),
      isLocked: true,
      tenantSlug: tenantSlug,
    ),
    AppRole(
      id: 'accounting_manager',
      name: 'Accounting Manager',
      description: 'Full access to accounting module only',
      modules: {AppModule.accountingModule},
      color: const Color(0xFFBA7517),
      isLocked: true,
      tenantSlug: tenantSlug,
    ),
    AppRole(
      id: 'operations_manager',
      name: 'Operations Manager',
      description: 'Full access to operations module only',
      modules: {AppModule.operationsModule},
      color: const Color(0xFF378ADD),
      isLocked: true,
      tenantSlug: tenantSlug,
    ),
    AppRole(
      id: 'employee',
      name: 'Employee',
      description: 'Self service only',
      modules: {},
      color: const Color(0xFF888780),
      isLocked: true,
      tenantSlug: tenantSlug,
    ),
  ];
  for (final role in predefined) {
    ref.read(rolesProvider.notifier).addRole(role);
  }
}
