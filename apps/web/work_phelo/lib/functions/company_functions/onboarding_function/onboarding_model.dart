import 'package:flutter/material.dart';

class UserModel {
  final String firstName;
  final String lastName;
  final String contact;
  final String email;
  final String? department;
  final String jobTitle;
  final List<String> systemRole;
  final String? reportingManager;
  final DateTime hiredDate;
  final String employmentType;
  final double annualSalary;
  final String? asset;
  final int? leaveDays;
  final EmploymentStatus status;
  final String password;
  final String tenantSlug;
  final DateTime? lastLeaveReset;

  UserModel({
    required this.firstName,
    required this.lastName,
    required this.contact,
    required this.email,
    this.department,
    required this.jobTitle,
    required this.systemRole,
    this.reportingManager,
    required this.hiredDate,
    required this.employmentType,
    required this.annualSalary,
    this.asset,
    this.leaveDays,
    this.status = EmploymentStatus.active,
    required this.password,
    required this.tenantSlug,
    this.lastLeaveReset,
  });

  String get fullName => '$firstName $lastName'.trim();

  UserModel copyWith({
    String? firstName,
    String? lastName,
    String? contact,
    String? email,
    String? department,
    String? jobTitle,
    List<String>? systemRole,
    String? reportingManager,
    DateTime? hiredDate,
    DateTime? lastLeaveReset,
    String? employmentType,
    double? annualSalary,
    String? asset,
    int? leaveDays,
    EmploymentStatus? status,
    String? password,
    String? tenantSlug,
  }) {
    return UserModel(
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      contact: contact ?? this.contact,
      email: email ?? this.email,
      department: department ?? this.department,
      jobTitle: jobTitle ?? this.jobTitle,
      systemRole: systemRole ?? this.systemRole,
      reportingManager: reportingManager ?? this.reportingManager,
      hiredDate: hiredDate ?? this.hiredDate,
      lastLeaveReset: lastLeaveReset ?? this.lastLeaveReset,
      employmentType: employmentType ?? this.employmentType,
      annualSalary: annualSalary ?? this.annualSalary,
      asset: asset ?? this.asset,
      leaveDays: leaveDays ?? this.leaveDays,
      status: status ?? this.status,
      password: password ?? this.password,
      tenantSlug: tenantSlug ?? this.tenantSlug,
    );
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      firstName: map['firstName'] as String? ?? '',
      lastName: map['lastName'] as String? ?? '',
      contact: map['contact'] as String? ?? '',
      email: map['email'] as String? ?? '',
      department: map['department'] as String?,
      jobTitle: map['jobTitle'] as String? ?? '',
      systemRole:
          (map['systemRole'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          ['employee'],
      reportingManager: map['reportingManager'] as String?,
      hiredDate: DateTime.parse(map['hiredDate'] as String),
      lastLeaveReset: DateTime.parse(map['lastLeaveReset'] as String),
      employmentType: map['employmentType'] as String? ?? '',
      annualSalary: (map['annualSalary'] as num?)?.toDouble() ?? 0.0,
      asset: map['asset'] as String?,
      leaveDays: map['leaveDays'] as int?,
      status: EmploymentStatusX.fromString(map['status'] as String?),
      password: map['password'] as String,
      tenantSlug: map['tenantSlug'] as String,
    );
  }
  factory UserModel.empty() {
    return UserModel(
      firstName: '',
      lastName: '',
      contact: '',
      email: '',
      department: '',
      jobTitle: '',
      systemRole: [],
      reportingManager: '',
      hiredDate: DateTime.now(),
      lastLeaveReset: DateTime.now(),
      employmentType: '',
      annualSalary: 0.00,
      asset: '',
      leaveDays: 0,
      status: EmploymentStatus.active,
      password: '',
      tenantSlug: '',
    );
  }
  Map<String, dynamic> toMap() {
    return {
      'firstName': firstName,
      'lastName': lastName,
      'contact': contact,
      'email': email,
      'department': department,
      'jobTitle': jobTitle,
      'systemRole': systemRole,
      'reportingManager': reportingManager,
      'hiredDate': hiredDate.toIso8601String(),
      'lastLeaveReset': lastLeaveReset!.toIso8601String(),
      'employmentType': employmentType,
      'annualSalary': annualSalary,
      'asset': asset,
      'leaveDays': leaveDays,
      'status': status.mapKey,
      'password': password,
      'tenantSlug': tenantSlug,
    };
  }
}

enum EmploymentStatus { active, onLeave, inactive }

extension EmploymentStatusX on EmploymentStatus {
  String get label => switch (this) {
    EmploymentStatus.active => 'Active',
    EmploymentStatus.onLeave => 'On Leave',
    EmploymentStatus.inactive => 'Inactive',
  };

  String get mapKey => switch (this) {
    EmploymentStatus.active => 'active',
    EmploymentStatus.onLeave => 'on_leave',
    EmploymentStatus.inactive => 'inactive',
  };

  static EmploymentStatus fromString(String? value) => switch (value) {
    'active' => EmploymentStatus.active,
    'on_leave' => EmploymentStatus.onLeave,
    'inactive' => EmploymentStatus.inactive,
    _ => EmploymentStatus.active, // safe default
  };

  Color get color => switch (this) {
    EmploymentStatus.active => Colors.green,
    EmploymentStatus.onLeave => Colors.orange,
    EmploymentStatus.inactive => Colors.red,
  };
}

extension EmploymentStatusUI on EmploymentStatus {
  (Color bg, Color fg, String label) resolve(ColorScheme cs) => switch (this) {
        EmploymentStatus.active => (
            Colors.green.withAlpha(30),
            Colors.green,
            'Active',
          ),
        EmploymentStatus.onLeave => (
            cs.tertiaryContainer,
            cs.onTertiaryContainer,
            'On Leave',
          ),
        EmploymentStatus.inactive => (
            Colors.red.withAlpha(30),
            Colors.red,
            'Inactive',
          ),
      };
}