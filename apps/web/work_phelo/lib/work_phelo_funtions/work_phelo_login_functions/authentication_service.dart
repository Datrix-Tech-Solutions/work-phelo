import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';

import '../work_phelo_users/user_model.dart';

class AuthenticationService {
  final Ref _ref;
  // ignore: unused_field
  final Dio _dio;
  final FlutterSecureStorage _storage;

  AuthenticationService(this._ref, this._dio, this._storage);

  // ── Super admin stays as mock (created from backend, no API needed) ──
  static const _superAdminEmail = 'super.admin@mail.com';
  static const _superAdminPassword = 'Admin@12';
  static const _superAdminName = 'Administrator';
  static const _superAdminCompany = 'Datrix Tech Solutions';

  Future<AppUserModel> login({
    required String email,
    required String password,
  }) async {
    final trimmedEmail = email.trim().toLowerCase();

    // ── Super admin ──
    if (trimmedEmail == _superAdminEmail.toLowerCase() &&
        password == _superAdminPassword) {
      return AppUserModel.fromMap({
        'uid': 'super_admin_uid',
        'email': _superAdminEmail,
        'fullName': _superAdminName,
        'role': 'super_admin',
        'companyName': _superAdminCompany,
        'tenantSlug': '',
        'companyStatus': 'active',
        'lastLogin': DateTime.now().toIso8601String(),
      });
    }

    final mockResult = await _runMockChecks(trimmedEmail, password);
    if (mockResult != null) return mockResult;

   
    throw Exception('Incorrect Credentials');
  }

  Future<AppUserModel?> _runMockChecks(String email, String password) async {
    await Future.delayed(const Duration(milliseconds: 1400));

    final companies = _ref.read(companyProvider).companies;
    final matchedCompany = companies.cast<CompanyModel?>().firstWhere(
      (c) =>
          c != null &&
          c.adminEmail.toLowerCase() == email &&
          c.adminPassword == password &&
          c.status != CompanyStatus.inactive,
      orElse: () => null,
    );

    if (matchedCompany != null) {
      return AppUserModel.fromMap({
        'uid': 'platform_${email.hashCode}',
        'email': matchedCompany.adminEmail,
        'fullName': matchedCompany.adminName,
        'role': 'platform_owner',
        'companyName': matchedCompany.companyName,
        'tenantSlug': matchedCompany.tenantSlug,
        'companyStatus': matchedCompany.status.name,
        'lastLogin': DateTime.now().toIso8601String(),
      });
    }

    final users = _ref.read(userProvider).users;
    final matchedUser = users.cast<EmployeeModel?>().firstWhere(
      (u) =>
          u != null &&
          u.email.toLowerCase() == email &&
          u.password == password &&
          u.status != EmploymentStatus.inactive,
      orElse: () => null,
    );

    if (matchedUser != null) {
      final employeeCompany = companies.cast<CompanyModel?>().firstWhere(
        (c) => c != null && c.tenantSlug == matchedUser.tenantSlug,
        orElse: () => null,
      );
      return AppUserModel.fromMap({
        'uid': 'employee_${email.hashCode}',
        'email': matchedUser.email,
        'fullName': matchedUser.fullName,
        'role': matchedUser.systemRole.isNotEmpty
            ? matchedUser.systemRole.first
            : 'employee',
        'companyName': employeeCompany?.companyName ?? matchedUser.tenantSlug,
        'tenantSlug': matchedUser.tenantSlug,
        'companyStatus': 'active',
        'lastLogin': DateTime.now().toIso8601String(),
      });
    }

    return null;
  }

  Future<void> logout() async {
    await _storage.deleteAll();
  }

  Future<String?> getToken() async {
    return _storage.read(key: 'accessToken');
  }
}

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.read(secureStorageProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: 'http://YOUR_DEV_IP:3000',
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ),
  );

  // Attach token to every request automatically
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read(key: 'accessToken');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ),
  );

  return dio;
});

final authenticationServiceProvider = Provider<AuthenticationService>((ref) {
  return AuthenticationService(
    ref,
    ref.read(dioProvider),
    ref.read(secureStorageProvider),
  );
});
