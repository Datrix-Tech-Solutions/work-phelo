import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../work_phelo_login_functions/authentication_service.dart';

class DashboardSummary {
  final String adminFirstName;
  final String companyName;
  final int totalEmployees;
  final int activeEmployees;
  final int pendingLeaveRequests;
  final int assignedAssetsCount;
  final bool hasEmployees;

  const DashboardSummary({
    this.adminFirstName = '',
    this.companyName = '',
    this.totalEmployees = 0,
    this.activeEmployees = 0,
    this.pendingLeaveRequests = 0,
    this.assignedAssetsCount = 0,
    this.hasEmployees = false,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    return DashboardSummary(
      adminFirstName: json['adminFirstName'] as String? ?? '',
      companyName: json['companyName'] as String? ?? '',
      totalEmployees: json['totalEmployees'] as int? ?? 0,
      activeEmployees: json['activeEmployees'] as int? ?? 0,
      pendingLeaveRequests: json['pendingLeaveRequests'] as int? ?? 0,
      assignedAssetsCount: json['assignedAssetsCount'] as int? ?? 0,
      hasEmployees: json['hasEmployees'] as bool? ?? false,
    );
  }
}

class DashboardSummaryNotifier extends StateNotifier<AsyncValue<DashboardSummary>> {
  final Dio _dio;

  DashboardSummaryNotifier(this._dio) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final response = await _dio.get('/hr/dashboard/summary');
      final data = response.data as Map<String, dynamic>;
      state = AsyncValue.data(DashboardSummary.fromJson(data));
    } on DioException catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }
}

final dashboardSummaryProvider = StateNotifierProvider<DashboardSummaryNotifier, AsyncValue<DashboardSummary>>((ref) {
  final dio = ref.read(dioProvider);
  return DashboardSummaryNotifier(dio);
});
