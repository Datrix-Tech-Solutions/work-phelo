import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import '../work_phelo_super_admin/company_onboarding_model.dart';
import '../work_phelo_users/user_model.dart';
import '../work_phelo_api/api_service.dart';
import 'auth_interceptor.dart';

class AuthenticationService {
  final ApiService _apiService;

  AuthenticationService(this._apiService);

  Future<AppUserModel> loginSuperAdmin({
    required String email,
    required String password,
  }) async {
    try {
      final data = await _apiService.loginSuperAdmin(
        email: email,
        password: password,
      );
      final userData = data['user'] as Map<String, dynamic>;
      return AppUserModel.fromLoginResponse(
        userData,
        companyName: 'Platform Administration',
      );
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }

  Future<AppUserModel> loginTenant({
    required String tenantSlug,
    required String email,
    required String password,
  }) async {
    try {
      final data = await _apiService.loginTenant(
        tenantSlug: tenantSlug,
        email: email,
        password: password,
      );
      final userData = data['user'] as Map<String, dynamic>;
      return AppUserModel.fromLoginResponse(userData, tenantSlug: tenantSlug);
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }

  Future<void> logout() async {
    await _apiService.logout();
  }

  //company registration
  Future<Map<String, dynamic>> registerTenant({
    required CompanyModel company,
  }) async {
    try {
      final data = await _apiService.registerTenant(company: company);
      return data;
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }

  String _extractError(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final raw = data['message'];
      if (raw is List && raw.isNotEmpty) {
        return raw.first.toString(); // ← handle list
      }
      if (raw is String) return raw;
      return data['error'] as String? ?? 'An error occurred';
    }
    return e.message ?? 'An error occurred';
  }

  Future<AppUserModel?> restoreSession() async {
    try {
      final data = await _apiService.dio.get('/auth/me');
      final userData = (data.data as Map<String, dynamic>)['user'] as Map<String, dynamic>;
      return AppUserModel.fromLoginResponse(userData, companyName: userData['tenantName'] as String? ?? '');
    } catch (_) {
      return null;
    }
  }

  Future<List<CompanyModel>> fetchTenants() async {
    try {
      final data = await _apiService.fetchTenants();
      final tenants = data['tenants'] as List<dynamic>;
      return tenants
          .map((t) => CompanyModel.fromApi(t as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }

  Future<void> approveTenant(String tenantId) async {
    try {
      await _apiService.approveTenant(tenantId);
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }

  Future<void> suspendTenant(String tenantId) async {
    try {
      await _apiService.suspendTenant(tenantId);
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }

  /////////////////////////////////////////////////////////
  Future<Map<String, dynamic>> inviteEmployee({
    required String tenantSlug,
    required EmployeeModel employee,
  }) async {
    try {
      final data = await _apiService.inviteEmployee(
        tenantSlug: tenantSlug,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.contact ?? '',
        role: employee.systemRole.isNotEmpty
            ? employee.systemRole.first
            : 'EMPLOYEE',
      );
      return data;
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }

  Future<List<EmployeeModel>> fetchEmployees() async {
    try {
      final data = await _apiService.fetchUsers();
      return data
          .map((u) => EmployeeModel.fromApi(u as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(_extractError(e));
    }
  }
}

//PROVIDERS

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: 'http://157.245.220.205/api/v1',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      extra: {'withCredentials': true},
    ),
  );

  dio.interceptors.add(AuthInterceptor(ref));
  return dio;
});

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService(ref.read(dioProvider));
});

final authenticationServiceProvider = Provider<AuthenticationService>((ref) {
  return AuthenticationService(ref.read(apiServiceProvider));
});
