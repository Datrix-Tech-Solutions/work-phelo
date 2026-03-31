import 'package:flutter/material.dart';

enum PermissionModule {
  onboarding,
  offboarding,
  leaveManagement,
  appraisal,
  timeClock,
  smartSchedule,
  projectTask,
  payroll,
  assetManagement,
  marketingModule,
  accountingModule,
  operationsModule;

  String get label => switch (this) {
    PermissionModule.onboarding => 'Onboarding',
    PermissionModule.offboarding => 'Offboarding',
    PermissionModule.leaveManagement => 'Leave management',
    PermissionModule.appraisal => 'Appraisal',
    PermissionModule.timeClock => 'Time Clock',
    PermissionModule.smartSchedule => 'Smart Schedules',
    PermissionModule.projectTask => 'Projects & Tasks',
    PermissionModule.payroll => 'Payroll',
    PermissionModule.assetManagement => 'Asset management',
    PermissionModule.marketingModule => 'Marketing module',
    PermissionModule.accountingModule => 'Accounting module',
    PermissionModule.operationsModule => 'Operations module',
  };

  String get description => switch (this) {
    PermissionModule.onboarding => 'Employee onboarding workflows',
    PermissionModule.offboarding => 'Employee offboarding workflows',
    PermissionModule.leaveManagement => 'Leave requests and approvals',
    PermissionModule.appraisal => 'Performance reviews',
    PermissionModule.timeClock => 'Can clock in',
    PermissionModule.smartSchedule =>
      'Can you smart schedule to create schedules',
    PermissionModule.projectTask => 'Can set projects and assign to members',
    PermissionModule.payroll => 'Can use payroll',
    PermissionModule.assetManagement => 'Company assets tracking',
    PermissionModule.marketingModule => 'Marketing tools and campaigns',
    PermissionModule.accountingModule => 'Finance and accounting',
    PermissionModule.operationsModule => 'Operations management',
  };
}

class EmployeePermission {
  final String id;
  final String name;
  final String description;
  final Set<PermissionModule> modules;
  final bool isLocked;
  final Color color;
  final String tenantSlug;
  const EmployeePermission({
    required this.id,
    required this.name,
    required this.description,
    required this.modules,
    required this.color,
    this.isLocked = false,
    required this.tenantSlug,
  });

  EmployeePermission copyWith({
    String? name,
    String? description,
    Set<PermissionModule>? modules,
    String? tenantSlug,
  }) {
    return EmployeePermission(
      id: id,
      name: name ?? this.name,
      description: description ?? this.description,
      modules: modules ?? this.modules,
      color: color,
      isLocked: isLocked,
      tenantSlug: tenantSlug ?? this.tenantSlug,
    );
  }
}
