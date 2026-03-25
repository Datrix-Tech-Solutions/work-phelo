import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'appraisal_models.dart';

class AppraisalState {
  final List<AppraisalTemplate> templates;
  final List<AppraisalRecord> records;
 
  const AppraisalState({
    this.templates = const [],
    this.records = const [],
  });
 
  AppraisalState copyWith({
    List<AppraisalTemplate>? templates,
    List<AppraisalRecord>? records,
  }) {
    return AppraisalState(
      templates: templates ?? this.templates,
      records: records ?? this.records,
    );
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Notifier
// ─────────────────────────────────────────────────────────────────────────────
 
class AppraisalNotifier extends StateNotifier<AppraisalState> {
  AppraisalNotifier() : super(const AppraisalState());
 
  // ── STEP 1: HR creates a template ────────────────────────────
 
  void createTemplate(AppraisalTemplate template) {
    state = state.copyWith(
      templates: [...state.templates, template],
    );
  }
 
  void updateTemplate(AppraisalTemplate updated) {
    state = state.copyWith(
      templates: state.templates
          .map((t) => t.id == updated.id ? updated : t)
          .toList(),
    );
  }
 
  void deleteTemplate(String templateId) {
    state = state.copyWith(
      templates: state.templates.where((t) => t.id != templateId).toList(),
    );
  }
 
  // ── STEP 2: HR assigns template to an employee ───────────────
  // Creates an AppraisalRecord in 'active' status
 
  void assignAppraisal({
    required String templateId,
    required String employeeEmail,
    required String managerEmail,
    required String tenantSlug,
    required String cycle,
  }) {
    final template = state.templates
        .where((t) => t.id == templateId)
        .firstOrNull;
 
    if (template == null) throw Exception('Template not found');
 
    // Prevent duplicate assignment for same employee + cycle
    final exists = state.records.any((r) =>
        r.employeeEmail == employeeEmail &&
        r.cycle == cycle &&
        r.tenantSlug == tenantSlug);
 
    if (exists) {
      throw Exception(
        '$employeeEmail already has an appraisal for $cycle',
      );
    }
 
    final record = AppraisalRecord(
      id: '${employeeEmail.hashCode}_${cycle}_${DateTime.now().millisecondsSinceEpoch}',
      templateId: templateId,
      tenantSlug: tenantSlug,
      cycle: cycle,
      employeeEmail: employeeEmail,
      managerEmail: managerEmail,
      status: AppraisalStatus.active,
      createdAt: DateTime.now(),
    );
 
    state = state.copyWith(records: [...state.records, record]);
  }
 
  // ── STEP 3a: Employee submits their self-assessment ──────────
 
  void submitEmployeeResponse({
    required String recordId,
    required String employeeEmail,
    required Map<String, int> ratings,
    Map<String, String> comments = const {},
  }) {
    _validateRatings(ratings);
 
    final record = _getRecord(recordId);
 
    if (record.employeeEmail != employeeEmail) {
      throw Exception('Not authorised to fill this appraisal');
    }
    if (record.status != AppraisalStatus.active) {
      throw Exception('Appraisal is not accepting responses');
    }
    if (record.employeeResponse != null) {
      throw Exception('Employee has already submitted');
    }
 
    final response = AppraisalResponse(
      respondentEmail: employeeEmail,
      isManager: false,
      ratings: ratings,
      comments: comments,
      submittedAt: DateTime.now(),
    );
 
    final updated = record.copyWith(employeeResponse: response);
 
    // Auto-advance to submitted if manager has also responded
    final finalRecord = updated.isFullySubmitted
        ? updated.copyWith(status: AppraisalStatus.submitted)
        : updated;
 
    _updateRecord(finalRecord);
  }
 
  // ── STEP 3b: Manager submits their assessment ────────────────
 
  void submitManagerResponse({
    required String recordId,
    required String managerEmail,
    required Map<String, int> ratings,
    Map<String, String> comments = const {},
  }) {
    _validateRatings(ratings);
 
    final record = _getRecord(recordId);
 
    if (record.managerEmail != managerEmail) {
      throw Exception('Not authorised to fill this appraisal');
    }
    if (record.status != AppraisalStatus.active) {
      throw Exception('Appraisal is not accepting responses');
    }
    if (record.managerResponse != null) {
      throw Exception('Manager has already submitted');
    }
 
    final response = AppraisalResponse(
      respondentEmail: managerEmail,
      isManager: true,
      ratings: ratings,
      comments: comments,
      submittedAt: DateTime.now(),
    );
 
    final updated = record.copyWith(managerResponse: response);
 
    // Auto-advance to submitted if employee has also responded
    final finalRecord = updated.isFullySubmitted
        ? updated.copyWith(status: AppraisalStatus.submitted)
        : updated;
 
    _updateRecord(finalRecord);
  }
 
  // ── STEP 4: HR approves or rejects ───────────────────────────
 
  void approveAppraisal({
    required String recordId,
    required String hrEmail,
    String? notes,
  }) {
    final record = _getRecord(recordId);
 
    if (record.status != AppraisalStatus.submitted) {
      throw Exception('Appraisal must be fully submitted before review');
    }
 
    _updateRecord(record.copyWith(
      status: AppraisalStatus.approved,
      reviewedBy: hrEmail,
      reviewedAt: DateTime.now(),
      hrNotes: notes,
    ));
  }
 
  void rejectAppraisal({
    required String recordId,
    required String hrEmail,
    String? notes,
  }) {
    final record = _getRecord(recordId);
 
    if (record.status != AppraisalStatus.submitted) {
      throw Exception('Appraisal must be fully submitted before review');
    }
 
    _updateRecord(record.copyWith(
      status: AppraisalStatus.rejected,
      reviewedBy: hrEmail,
      reviewedAt: DateTime.now(),
      hrNotes: notes,
    ));
  }
 
  // ── Private helpers ──────────────────────────────────────────
 
  AppraisalRecord _getRecord(String id) {
    final record = state.records.where((r) => r.id == id).firstOrNull;
    if (record == null) throw Exception('Appraisal record not found');
    return record;
  }
 
  void _updateRecord(AppraisalRecord updated) {
    state = state.copyWith(
      records: state.records
          .map((r) => r.id == updated.id ? updated : r)
          .toList(),
    );
  }
 
  void _validateRatings(Map<String, int> ratings) {
    for (final entry in ratings.entries) {
      if (entry.value < 1 || entry.value > 10) {
        throw Exception(
          'Rating for question ${entry.key} must be between 1 and 10',
        );
      }
    }
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────
 
final appraisalProvider =
    StateNotifierProvider<AppraisalNotifier, AppraisalState>((ref) {
  return AppraisalNotifier();
});
 
/// All templates for a company
final appraisalTemplatesByTenantProvider =
    Provider.family<List<AppraisalTemplate>, String>((ref, tenantSlug) {
  return ref
      .watch(appraisalProvider)
      .templates
      .where((t) => t.tenantSlug == tenantSlug)
      .toList();
});
 
/// Templates for a specific department within a company
final appraisalTemplatesByDeptProvider =
    Provider.family<List<AppraisalTemplate>, ({String tenantSlug, String department})>(
        (ref, args) {
  return ref
      .watch(appraisalTemplatesByTenantProvider(args.tenantSlug))
      .where((t) =>
          t.targetDepartment == null ||
          t.targetDepartment == args.department)
      .toList();
});
 
/// All records for a company
final appraisalRecordsByTenantProvider =
    Provider.family<List<AppraisalRecord>, String>((ref, tenantSlug) {
  return ref
      .watch(appraisalProvider)
      .records
      .where((r) => r.tenantSlug == tenantSlug)
      .toList();
});
 
/// Records for a specific employee
final appraisalRecordsByEmployeeProvider =
    Provider.family<List<AppraisalRecord>, String>((ref, employeeEmail) {
  return ref
      .watch(appraisalProvider)
      .records
      .where((r) => r.employeeEmail == employeeEmail)
      .toList();
});
 
/// Records pending HR review (fully submitted, awaiting approval)
final pendingHrReviewProvider =
    Provider.family<List<AppraisalRecord>, String>((ref, tenantSlug) {
  return ref
      .watch(appraisalRecordsByTenantProvider(tenantSlug))
      .where((r) => r.status == AppraisalStatus.submitted)
      .toList();
});
 
/// Records the manager needs to fill
final pendingManagerResponseProvider =
    Provider.family<List<AppraisalRecord>, String>((ref, managerEmail) {
  return ref
      .watch(appraisalProvider)
      .records
      .where((r) =>
          r.managerEmail == managerEmail &&
          r.status == AppraisalStatus.active &&
          r.managerResponse == null)
      .toList();
});
 
/// Records the employee needs to fill
final pendingEmployeeResponseProvider =
    Provider.family<List<AppraisalRecord>, String>((ref, employeeEmail) {
  return ref
      .watch(appraisalProvider)
      .records
      .where((r) =>
          r.employeeEmail == employeeEmail &&
          r.status == AppraisalStatus.active &&
          r.employeeResponse == null)
      .toList();
});
 
/// Records for a specific cycle within a company
final appraisalRecordsByCycleProvider =
    Provider.family<List<AppraisalRecord>, ({String tenantSlug, String cycle})>(
        (ref, args) {
  return ref
      .watch(appraisalRecordsByTenantProvider(args.tenantSlug))
      .where((r) => r.cycle == args.cycle)
      .toList();
});