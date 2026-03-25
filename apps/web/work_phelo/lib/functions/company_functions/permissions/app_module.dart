import 'package:flutter/material.dart';

enum AppModule {
  onboarding,
  offboarding,
  leaveManagement,
  appraisal,
  assetManagement,
  marketingModule,
  accountingModule,
  operationsModule;

  String get label => switch (this) {
    AppModule.onboarding => 'Onboarding',
    AppModule.offboarding => 'Offboarding',
    AppModule.leaveManagement => 'Leave management',
    AppModule.appraisal => 'Appraisal',
    AppModule.assetManagement => 'Asset management',
    AppModule.marketingModule => 'Marketing module',
    AppModule.accountingModule => 'Accounting module',
    AppModule.operationsModule => 'Operations module',
  };

  String get description => switch (this) {
    AppModule.onboarding => 'Employee onboarding workflows',
    AppModule.offboarding => 'Employee offboarding workflows',
    AppModule.leaveManagement => 'Leave requests and approvals',
    AppModule.appraisal => 'Performance reviews',
    AppModule.assetManagement => 'Company assets tracking',
    AppModule.marketingModule => 'Marketing tools and campaigns',
    AppModule.accountingModule => 'Finance and accounting',
    AppModule.operationsModule => 'Operations management',
  };
}

class AppRole {
  final String id;
  final String name;
  final String description;
  final Set<AppModule> modules;
  final bool isLocked;
  final Color color;
  final String tenantSlug;
  const AppRole({
    required this.id,
    required this.name,
    required this.description,
    required this.modules,
    required this.color,
    this.isLocked = false,
    required this.tenantSlug
  });

  AppRole copyWith({
    String? name,
    String? description,
    Set<AppModule>? modules,
    String? tenantSlug,
  }) {
    return AppRole(
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