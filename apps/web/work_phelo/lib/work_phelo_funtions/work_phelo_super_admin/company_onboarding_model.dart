import 'package:flutter/material.dart';

enum CompanyStatus { active, inactive, pending }

extension CompanyStatusX on CompanyStatus {
  String get label => switch (this) {
    CompanyStatus.active => 'Active',
    CompanyStatus.inactive => 'Inactive',
    CompanyStatus.pending => 'Pending',
  };

  String get mapKey => switch (this) {
    CompanyStatus.active => 'active',
    CompanyStatus.inactive => 'inactive',
    CompanyStatus.pending => 'pending',
  };

  static CompanyStatus fromString(String? value) => switch (value) {
    'active' => CompanyStatus.active,
    'inactive' => CompanyStatus.inactive,
    'pending' => CompanyStatus.pending,
    _ => CompanyStatus.pending,
  };

  Color get color => switch (this) {
    CompanyStatus.active => Colors.green,
    CompanyStatus.inactive => Colors.red,
    CompanyStatus.pending => Colors.orange,
  };
}

// [adminPassword]

class CompanyModel {
  final String companyName;
  final String? companyContact;
  final String? companySize;
  final String? companyLocation;
  final String? companyIndustry;
  final String adminFirstName;
  final String adminLastName;
  final String? adminContact;
  final String adminEmail;
  final DateTime? onboardedDate;
  final CompanyStatus status;
  final String systemRole;
  final String adminPassword;
  final List<String> enabledModules;

  CompanyModel({
    required this.companyName,
    this.companyContact,
    this.companySize,
    this.companyLocation,
    this.companyIndustry,
    required this.adminFirstName,
    required this.adminLastName,
    this.adminContact,
    required this.adminEmail,
    this.onboardedDate,
    this.status = CompanyStatus.pending,
    required this.systemRole,
    required this.adminPassword,
    this.enabledModules=const [],
  });

  // ── Computed getters ────────────────────────────────────────
  String get adminName => '$adminFirstName $adminLastName'.trim();

  String get companyDomain {
    final parts = adminEmail.split('@');
    return parts.length == 2 ? parts[1] : '';
  }

  String get tenantSlug => companyName
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), '-')
      .replaceAll(RegExp(r'[^a-z0-9\-]'), '');

  // ── copyWith ────────────────────────────────────────────────
  CompanyModel copyWith({
    String? companyName,
    String? companyContact,
    String? companySize,
    String? companyLocation,
    String? companyIndustry,
    String? adminFirstName,
    String? adminLastName,
    String? adminContact,
    String? adminEmail,
    DateTime? onboardedDate,
    CompanyStatus? status,
    String? systemRole,
    String? adminPassword,
    List<String>? enabledModules,
  }) {
    return CompanyModel(
      companyName: companyName ?? this.companyName,
      companyContact: companyContact ?? this.companyContact,
      companySize: companySize ?? this.companySize,
      companyLocation: companyLocation ?? this.companyLocation,
      companyIndustry: companyIndustry ?? this.companyIndustry,
      adminFirstName: adminFirstName ?? this.adminFirstName,
      adminLastName: adminLastName ?? this.adminLastName,
      adminContact: adminContact ?? this.adminContact,
      adminEmail: adminEmail ?? this.adminEmail,
      adminPassword: adminPassword ?? this.adminPassword,
      onboardedDate: onboardedDate ?? this.onboardedDate,
      status: status ?? this.status,
      systemRole: systemRole ?? this.systemRole,
      enabledModules: enabledModules?? this.enabledModules
    );
  }

  // ── fromMap ─────────────────────────────────────────────────
  factory CompanyModel.fromMap(Map<String, dynamic> map) {
    return CompanyModel(
      companyName: map['companyName'] as String,
      adminFirstName: map['adminFirstName'] as String,
      adminLastName: map['adminLastName'] as String,
      adminEmail: map['adminEmail'] as String,
      companyContact: map['companyContact'] as String?,
      companySize: map['companySize'] as String?,
      companyIndustry: map['companyIndustry'] as String?,
      companyLocation: map['companyLocation'] as String?,
      adminContact: map['adminContact'] as String?,
      status: CompanyStatusX.fromString(map['status'] as String),
      onboardedDate: map['onboardedDate'] != null
          ? DateTime.parse(map['onboardedDate'] as String)
          : null,
      systemRole: map['systemRole'] as String? ?? '',
      adminPassword: map['adminPassword'] as String,
      enabledModules: (map['enabledModules'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList() ?? [],
    );
  }

  // ── empty ───────────────────────────────────────────────────
  factory CompanyModel.empty() {
    return CompanyModel(
      companyName: '',
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
      systemRole: '',
      adminPassword: '',
    );
  }

  // ── toMap ───────────────────────────────────────────────────
  Map<String, dynamic> toMap() {
    return {
      'companyName': companyName,
      'companyContact': companyContact,
      'companySize': companySize,
      'companyLocation': companyLocation,
      'companyIndustry': companyIndustry,
      'adminFirstName': adminFirstName,
      'adminLastName': adminLastName,
      'adminEmail': adminEmail,
      'adminContact': adminContact,
      'onboardedDate': onboardedDate?.toIso8601String(),
      'status': status.mapKey,
      'tenantSlug': tenantSlug,
      'companyDomain': companyDomain,
      'systemRole': systemRole,
      'adminPassword': adminPassword,
      'enabledModules':enabledModules,
    };
  }
}

class ModuleConfig {
  final String key;
  final String name;
  final String description;
  final IconData icon;
  bool isEnabled;

  ModuleConfig({
    required this.key,
    required this.name,
    required this.description,
    required this.icon,
    this.isEnabled = false,
  });
}