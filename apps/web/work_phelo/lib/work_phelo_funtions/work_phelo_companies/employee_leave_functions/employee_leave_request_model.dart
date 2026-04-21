enum LeaveType { annual, sick, maternity, paternity, unpaid, study }

enum LeaveStatus { pending, approved, rejected }

class LeaveRule {
  final int? maxDays; // null = unlimited

  const LeaveRule({this.maxDays});
}

final leaveRules = {
  LeaveType.sick: LeaveRule(maxDays: 14),
  LeaveType.maternity: LeaveRule(maxDays: 90),
  LeaveType.paternity: LeaveRule(maxDays: 30),
  LeaveType.study: LeaveRule(maxDays: 365),
  LeaveType.unpaid: LeaveRule(maxDays: null),
};

class LeaveRequestModel {
  final String id;
  final String employeeEmail;
  final LeaveType type;
  final DateTime startDate;
  final DateTime endDate;
  final String reason;
  final LeaveStatus status;
  final String tenantSlug;
  final String? approvedBy;
  final DateTime? approvedAt;

  final DateTime createdAt;

  LeaveRequestModel({
    required this.id,
    required this.employeeEmail,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.reason,
    this.status = LeaveStatus.pending,
    required this.tenantSlug,
    this.approvedBy,
    this.approvedAt,
    required this.createdAt,
  });

  int get totalDays => endDate.difference(startDate).inDays + 1;

  LeaveRequestModel copyWith({
    LeaveStatus? status,
    String? approvedBy,
    DateTime? approvedAt,
    String? tenantSlug,
  }) {
    return LeaveRequestModel(
      id: id,
      employeeEmail: employeeEmail,
      type: type,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      status: status ?? this.status,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      approvedBy: approvedBy ?? this.approvedBy,
      approvedAt: approvedAt ?? this.approvedAt,
      createdAt: createdAt,
    );
  }
}

extension LeaveTypeX on LeaveType {
  static LeaveType fromString(String value) =>
      LeaveType.values.firstWhere(
        (e) => e.name.toLowerCase() == value.toLowerCase(),
        orElse: () => LeaveType.annual,
      );

  String get label => switch (this) {
    LeaveType.annual => 'Annual',
    LeaveType.sick => 'Sick',
    LeaveType.maternity => 'Maternity',
    LeaveType.paternity => 'Paternity',
    LeaveType.unpaid => 'Unpaid',
    LeaveType.study => 'Study',
  };
}