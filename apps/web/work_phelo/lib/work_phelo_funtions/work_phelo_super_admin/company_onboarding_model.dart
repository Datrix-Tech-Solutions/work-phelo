import 'package:flutter/material.dart';

enum CompanyStatus { active, inactive, pending, suspended }

extension CompanyStatusX on CompanyStatus {
  String get label => switch (this) {
    CompanyStatus.active => 'ACTIVE',
    CompanyStatus.inactive => 'INACTIVE',
    CompanyStatus.pending => 'PENDING',
    CompanyStatus.suspended => 'SUSPENDED',
  };

  String get mapKey => switch (this) {
    CompanyStatus.active => 'ACTIVE',
    CompanyStatus.inactive => 'INACTIVE',
    CompanyStatus.pending => 'PENDING',
    CompanyStatus.suspended => 'SUSPENDED',
  };

  static CompanyStatus fromString(String? value) => switch (value) {
    'ACTIVE' => CompanyStatus.active,
    'INACTIVE' => CompanyStatus.inactive,
    'PENDING' => CompanyStatus.pending,
    'SUSPENDED' => CompanyStatus.suspended,
    _ => CompanyStatus.pending,
  };

  Color get color => switch (this) {
    CompanyStatus.active => Colors.green,
    CompanyStatus.inactive => Colors.amber,
    CompanyStatus.pending => Colors.blue,
    CompanyStatus.suspended => Colors.red,
  };
}

// [adminPassword]

class CompanyModel {
  final String companyName;
  final String? tenantId;
  final String? companyContact;
  final String? companySize;
  final String? companyLocation;
  final String? companyCountry;
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
  final String? slug;

  CompanyModel({
    required this.companyName,
    this.tenantId,
    this.companyContact,
    this.companySize,
    this.companyLocation,
    this.companyCountry,
    this.companyIndustry,
    required this.adminFirstName,
    required this.adminLastName,
    this.adminContact,
    required this.adminEmail,
    this.onboardedDate,
    this.status = CompanyStatus.active,
    required this.systemRole,
    required this.adminPassword,
    this.enabledModules = const [],
    this.slug,
  });

  // ── Computed getters ────────────────────────────────────────
  String get adminName => '$adminFirstName $adminLastName'.trim();

  String get companyDomain {
    final parts = adminEmail.split('@');
    return parts.length == 2 ? parts[1] : '';
  }

  String get tenantSlug => slug ?? companyName
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), '-')
      .replaceAll(RegExp(r'[^a-z0-9\-]'), '');

  // ── copyWith ────────────────────────────────────────────────
  CompanyModel copyWith({
    String? companyName,
    String? tenantId,
    String? companyContact,
    String? companySize,
    String? companyLocation,
    String? companyCountry,
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
      tenantId: tenantId ?? this.tenantId,
      companyContact: companyContact ?? this.companyContact,
      companySize: companySize ?? this.companySize,
      companyLocation: companyLocation ?? this.companyLocation,
      companyCountry: companyCountry ?? this.companyCountry,
      companyIndustry: companyIndustry ?? this.companyIndustry,
      adminFirstName: adminFirstName ?? this.adminFirstName,
      adminLastName: adminLastName ?? this.adminLastName,
      adminContact: adminContact ?? this.adminContact,
      adminEmail: adminEmail ?? this.adminEmail,
      adminPassword: adminPassword ?? this.adminPassword,
      onboardedDate: onboardedDate ?? this.onboardedDate,
      status: status ?? this.status,
      systemRole: systemRole ?? this.systemRole,
      enabledModules: enabledModules ?? this.enabledModules,
      slug: slug ?? this.slug,
    );
  }

  // ── fromMap ─────────────────────────────────────────────────
  factory CompanyModel.fromMap(Map<String, dynamic> map) {
    return CompanyModel(
      companyName: map['companyName'] as String,
      tenantId: map['tenantId'] as String?,
      adminFirstName: map['adminFirstName'] as String,
      adminLastName: map['adminLastName'] as String,
      adminEmail: map['adminEmail'] as String,
      companyContact: map['companyContact'] as String?,
      companySize: map['companySize'] as String?,
      companyIndustry: map['companyIndustry'] as String?,
      companyLocation: map['companyLocation'] as String?,
      companyCountry: map['companyCountry'] as String?,
      adminContact: map['adminContact'] as String?,
      status: CompanyStatusX.fromString(map['status'] as String),
      onboardedDate: map['onboardedDate'] != null
          ? DateTime.parse(map['onboardedDate'] as String)
          : null,
      systemRole: map['systemRole'] as String? ?? '',
      adminPassword: map['adminPassword'] as String,
      enabledModules:
          (map['enabledModules'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
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
      'tenantId': tenantId,
      'companyContact': companyContact,
      'companySize': companySize,
      'companyLocation': companyLocation,
      'companyCountry': companyCountry,
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
      'enabledModules': enabledModules,
    };
  }

  factory CompanyModel.fromApi(Map<String, dynamic> json) {
    return CompanyModel(
      companyName: json['name'] as String? ?? '',
      adminFirstName: '',
      adminLastName: '',
      adminEmail: json['email'] as String? ?? '',
      adminContact: json['phone'] as String?,
      companyCountry: json['country'] as String?,
      companyIndustry: json['industry'] as String?,
      companySize: json['size'] as String?,
      tenantId: json['id'] as String?,
      systemRole: 'TENANT_ADMIN',
      adminPassword: '',
      status: CompanyStatusX.fromString(
        (json['status'] as String? ?? 'pending'),
      ),
      onboardedDate: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      enabledModules: const [],
      slug: json['slug'] as String?,
    );
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
