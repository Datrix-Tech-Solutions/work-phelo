import 'dart:developer';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

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
    final data = await _apiService.loginSuperAdmin(
      email: email,
      password: password,
    );
    final userData = data['user'] as Map<String, dynamic>;
    return AppUserModel.fromLoginResponse(
      userData,
      companyName: 'Platform Administration',
    );
  }

  Future<AppUserModel> loginTenant({
    required String tenantSlug,
    required String email,
    required String password,
  }) async {
    final data = await _apiService.loginTenant(
      tenantSlug: tenantSlug,
      email: email,
      password: password,
    );
    final userData = data['user'] as Map<String, dynamic>;

    log('SERVICE >> tenantSlug being passed: $tenantSlug');

    return AppUserModel.fromLoginResponse(userData, tenantSlug: tenantSlug);
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
      return data['message'] as String? ??
          data['error'] as String? ??
          'An error occurred';
    }
    return e.message ?? 'An error occurred';
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
}

//PROVIDERS

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: 'http://localhost:4001',
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
