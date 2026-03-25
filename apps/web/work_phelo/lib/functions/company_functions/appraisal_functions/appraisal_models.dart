// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────
 
enum AppraisalStatus {
  draft,      // HR created template, not yet sent
  active,     // sent to employee and manager
  submitted,  // both employee and manager have filled
  approved,   // HR approved
  rejected,   // HR rejected
}
 
extension AppraisalStatusX on AppraisalStatus {
  String get label => switch (this) {
    AppraisalStatus.draft => 'Draft',
    AppraisalStatus.active => 'Active',
    AppraisalStatus.submitted => 'Submitted',
    AppraisalStatus.approved => 'Approved',
    AppraisalStatus.rejected => 'Rejected',
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// AppraisalQuestion — a single question in a template
// ─────────────────────────────────────────────────────────────────────────────
 
class AppraisalQuestion {
  final String id;
  final String text;
  final int order;
 
  const AppraisalQuestion({
    required this.id,
    required this.text,
    required this.order,
  });
 
  AppraisalQuestion copyWith({String? text, int? order}) {
    return AppraisalQuestion(
      id: id,
      text: text ?? this.text,
      order: order ?? this.order,
    );
  }
 
  Map<String, dynamic> toMap() => {'id': id, 'text': text, 'order': order};
 
  factory AppraisalQuestion.fromMap(Map<String, dynamic> map) {
    return AppraisalQuestion(
      id: map['id'] as String,
      text: map['text'] as String,
      order: map['order'] as int,
    );
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// AppraisalTemplate — HR creates this per department/role
// ─────────────────────────────────────────────────────────────────────────────
 
class AppraisalTemplate {
  final String id;
  final String name;           // e.g. "Engineering Q1 2025"
  final String tenantSlug;
  final String cycle;          // e.g. "Q1 2025"
  final String? targetDepartment; // null = applies to all
  final List<AppraisalQuestion> questions;
  final DateTime createdAt;
  final String createdBy;      // HR email
 
  const AppraisalTemplate({
    required this.id,
    required this.name,
    required this.tenantSlug,
    required this.cycle,
    this.targetDepartment,
    required this.questions,
    required this.createdAt,
    required this.createdBy,
  });
 
  AppraisalTemplate copyWith({
    String? name,
    String? cycle,
    String? targetDepartment,
    List<AppraisalQuestion>? questions,
  }) {
    return AppraisalTemplate(
      id: id,
      name: name ?? this.name,
      tenantSlug: tenantSlug,
      cycle: cycle ?? this.cycle,
      targetDepartment: targetDepartment ?? this.targetDepartment,
      questions: questions ?? this.questions,
      createdAt: createdAt,
      createdBy: createdBy,
    );
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// AppraisalResponse — one set of answers (employee OR manager)
// ─────────────────────────────────────────────────────────────────────────────
 
class AppraisalResponse {
  final String respondentEmail;
  final bool isManager;
  final Map<String, int> ratings;    // questionId → rating (1–10)
  final Map<String, String> comments; // questionId → optional comment
  final DateTime submittedAt;
 
  const AppraisalResponse({
    required this.respondentEmail,
    required this.isManager,
    required this.ratings,
    this.comments = const {},
    required this.submittedAt,
  });
 
  // Average score across all questions
  double get averageScore {
    if (ratings.isEmpty) return 0;
    return ratings.values.reduce((a, b) => a + b) / ratings.length;
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// AppraisalRecord — one appraisal for one employee in one cycle
// ─────────────────────────────────────────────────────────────────────────────
 
class AppraisalRecord {
  final String id;
  final String templateId;
  final String tenantSlug;
  final String cycle;
  final String employeeEmail;
  final String managerEmail;
  final AppraisalStatus status;
  final AppraisalResponse? employeeResponse;
  final AppraisalResponse? managerResponse;
  final String? hrNotes;         // HR notes on approval/rejection
  final String? reviewedBy;      // HR email
  final DateTime? reviewedAt;
  final DateTime createdAt;
 
  const AppraisalRecord({
    required this.id,
    required this.templateId,
    required this.tenantSlug,
    required this.cycle,
    required this.employeeEmail,
    required this.managerEmail,
    this.status = AppraisalStatus.active,
    this.employeeResponse,
    this.managerResponse,
    this.hrNotes,
    this.reviewedBy,
    this.reviewedAt,
    required this.createdAt,
  });
 
  // Both have submitted
  bool get isFullySubmitted =>
      employeeResponse != null && managerResponse != null;
 
  // Average of both responses
  double get combinedAverage {
    if (!isFullySubmitted) return 0;
    return (employeeResponse!.averageScore + managerResponse!.averageScore) / 2;
  }
 
  // Per-question average between employee and manager
  Map<String, double> get questionAverages {
    if (!isFullySubmitted) return {};
    final result = <String, double>{};
    for (final entry in employeeResponse!.ratings.entries) {
      final managerRating = managerResponse!.ratings[entry.key] ?? 0;
      result[entry.key] = (entry.value + managerRating) / 2;
    }
    return result;
  }
 
  AppraisalRecord copyWith({
    AppraisalStatus? status,
    AppraisalResponse? employeeResponse,
    AppraisalResponse? managerResponse,
    String? hrNotes,
    String? reviewedBy,
    DateTime? reviewedAt,
  }) {
    return AppraisalRecord(
      id: id,
      templateId: templateId,
      tenantSlug: tenantSlug,
      cycle: cycle,
      employeeEmail: employeeEmail,
      managerEmail: managerEmail,
      status: status ?? this.status,
      employeeResponse: employeeResponse ?? this.employeeResponse,
      managerResponse: managerResponse ?? this.managerResponse,
      hrNotes: hrNotes ?? this.hrNotes,
      reviewedBy: reviewedBy ?? this.reviewedBy,
      reviewedAt: reviewedAt ?? this.reviewedAt,
      createdAt: createdAt,
    );
  }
}