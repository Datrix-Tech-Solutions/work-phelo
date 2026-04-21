import 'package:flutter/material.dart';

class EmployeeModel {
  final String firstName;
  final String lastName;
  final String? contact;
  final String email;
  final DateTime? dob;
  final String? department;
  final String jobTitle;
  final List<String> systemRole;
  final String? reportingManager;
  final DateTime hiredDate;
  final String employmentType;
  final double? annualSalary;
  final String? asset;
  final int? leaveDays;
  final EmploymentStatus status;
  final String password;
  final String tenantSlug;
  final DateTime? lastLeaveReset;

  EmployeeModel({
    required this.firstName,
    required this.lastName,
    this.dob,
    this.contact,
    required this.email,
    this.department,
    required this.jobTitle,
    required this.systemRole,
    this.reportingManager,
    required this.hiredDate,
    required this.employmentType,
    this.annualSalary,
    this.asset,
    this.leaveDays,
    this.status = EmploymentStatus.pending,
    required this.password,
    required this.tenantSlug,
    this.lastLeaveReset,
  });

  String get fullName => '$firstName $lastName'.trim();

  EmployeeModel copyWith({
    String? firstName,
    String? lastName,
    String? contact,
    DateTime? dob,
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
    return EmployeeModel(
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      dob: dob ?? this.dob,
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

  factory EmployeeModel.fromMap(Map<String, dynamic> map) {
    return EmployeeModel(
      firstName: map['firstName'] as String? ?? '',
      lastName: map['lastName'] as String? ?? '',
      dob: DateTime.parse(map['dob'] as String),
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
  factory EmployeeModel.empty() {
    return EmployeeModel(
      firstName: '',
      lastName: '',
      dob: DateTime.now(),
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
      'dob': dob,
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
  factory EmployeeModel.fromApi(Map<String, dynamic> json) {
  return EmployeeModel(
    firstName: json['firstName'] as String? ?? '',
    lastName: json['lastName'] as String? ?? '',
    email: json['email'] as String? ?? '',
    contact: json['phone'] as String?,
    jobTitle: '',
    systemRole: [json['role'] as String? ?? 'EMPLOYEE'],
    hiredDate: json['createdAt'] != null
        ? DateTime.parse(json['createdAt'] as String)
        : DateTime.now(),
    employmentType: '',
    password: '',
    tenantSlug: '',
    status: _parseStatus(json['status'] as String? ?? 'PENDING_VERIFICATION'),
  );
}

static EmploymentStatus _parseStatus(String status) {
  return switch (status.toUpperCase()) {
    'ACTIVE' => EmploymentStatus.active,
    'INACTIVE' => EmploymentStatus.inactive,
    'ON_LEAVE' => EmploymentStatus.onLeave,
    _ => EmploymentStatus.pending,
  };
}
}

enum EmploymentStatus { active, onLeave, inactive, pending }

extension EmploymentStatusX on EmploymentStatus {
  String get label => switch (this) {
    EmploymentStatus.active => 'Active',
    EmploymentStatus.onLeave => 'On Leave',
    EmploymentStatus.inactive => 'Inactive',
    EmploymentStatus.pending => 'Pending',
  };

  String get mapKey => switch (this) {
    EmploymentStatus.active => 'active',
    EmploymentStatus.onLeave => 'on_leave',
    EmploymentStatus.inactive => 'inactive',
    EmploymentStatus.pending => 'pending',
  };

  static EmploymentStatus fromString(String? value) => switch (value) {
    'active' => EmploymentStatus.active,
    'on_leave' => EmploymentStatus.onLeave,
    'inactive' => EmploymentStatus.inactive,
    'pending' => EmploymentStatus.pending,
    _ => EmploymentStatus.pending, //default statys
  };

  Color get color => switch (this) {
    EmploymentStatus.active => Colors.green,
    EmploymentStatus.onLeave => Colors.orange,
    EmploymentStatus.inactive => Colors.red,
    EmploymentStatus.pending => Colors.blue,
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
    EmploymentStatus.pending => (
      Colors.blue.withAlpha(30),
      Colors.blue,
      'Pending Invite',
    ),
  };
}
