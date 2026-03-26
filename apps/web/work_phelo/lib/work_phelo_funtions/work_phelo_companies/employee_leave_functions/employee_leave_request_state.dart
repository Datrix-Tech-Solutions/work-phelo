import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';

import 'employee_leave_request_model.dart';

class EmployeeLeaveState {
  final List<LeaveRequestModel> requests;
  final bool isLoading;
  final String? error;

  const EmployeeLeaveState({
    this.requests = const [],
    this.isLoading = false,
    this.error,
  });

  EmployeeLeaveState copyWith({
    List<LeaveRequestModel>? requests,
    bool? isLoading,
    String? error,
  }) {
    return EmployeeLeaveState(
      requests: requests ?? this.requests,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

//notifier
class LeaveNotifier extends StateNotifier<EmployeeLeaveState> {
  final Ref ref;

  LeaveNotifier(this.ref) : super(const EmployeeLeaveState());

  void applyLeave(LeaveRequestModel request) {
    final user = ref.read(userProvider).users
      .where((u) =>
          u.email == request.employeeEmail &&
          u.tenantSlug == request.tenantSlug)
      .firstOrNull;

  if (user == null) throw Exception('Employee not found');

    final days = request.totalDays;

    if (request.endDate.isBefore(request.startDate)) {
      throw Exception("End date cannot be before start date");
    }

    if (request.type == LeaveType.annual) {
      if ((user.leaveDays ?? 0) < days) {
        throw Exception("Not enough annual leave days");
      }
    } else {
      final rule = leaveRules[request.type];

      if (rule?.maxDays != null && days > rule!.maxDays!) {
        throw Exception(
          "Max ${rule.maxDays} days allowed for ${request.type.name}",
        );
      }
    }

    state = state.copyWith(requests: [...state.requests, request]);
  }

  void approveLeave(String id, String adminEmail) {
    final updated = state.requests.map((r) {
      if (r.id != id) return r;

      // deduct only annual leave
      if (r.type == LeaveType.annual) {
        ref
            .read(userProvider.notifier)
            .deductLeave(r.employeeEmail, r.totalDays);
      }

      // update status
      ref.read(userProvider.notifier).setOnLeave(r.employeeEmail);

      return r.copyWith(
        status: LeaveStatus.approved,
        approvedBy: adminEmail,
        approvedAt: DateTime.now(),
      );
    }).toList();

    state = state.copyWith(requests: updated);
  }

  void rejectLeave(String id, String adminEmail) {
    final updated = state.requests.map((r) {
      if (r.id != id) return r;

      return r.copyWith(
        status: LeaveStatus.rejected,
        approvedBy: adminEmail,
        approvedAt: DateTime.now(),
      );
    }).toList();

    state = state.copyWith(requests: updated);
  }
}

//provider
final leaveProvider = StateNotifierProvider<LeaveNotifier, EmployeeLeaveState>((ref) {
  return LeaveNotifier(ref);
});
