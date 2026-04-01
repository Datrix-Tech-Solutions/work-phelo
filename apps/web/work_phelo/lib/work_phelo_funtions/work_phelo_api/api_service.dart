import 'package:dio/dio.dart';

import '../work_phelo_super_admin/company_onboarding_model.dart';

class ApiService {
  final Dio dio;

  ApiService(this.dio);
  //login api calls
  Future<Map<String, dynamic>> loginSuperAdmin({
    required String email,
    required String password,
  }) async {
    final response = await dio.post(
      '/auth/admin/login',
      data: {'email': email, 'password': password},
    );
    return response.data as Map<String, dynamic>;
  }

  //login tenant api call
  Future<Map<String, dynamic>> loginTenant({
    required String tenantSlug,
    required String email,
    required String password,
  }) async {
    final response = await dio.post(
      '/auth/login',
      data: {'tenantSlug': tenantSlug, 'email': email, 'password': password},
    );
    return response.data as Map<String, dynamic>;
  }

  //app logout api call

  Future<void> logout() async {
    await dio.post('/auth/logout');
  }

  Future<bool?> refreshToken() async {
    try {
      await dio.post('/auth/refresh');
      return true;
    } catch (_) {
      return false;
    }
  }

  //register company api call
  Future<Map<String, dynamic>> registerTenant({
    required CompanyModel company,
  }) async {
    final response = await dio.post(
      '/auth/tenants/register',
      data: {
        'name': company.companyName,
        'slug': company.tenantSlug,
        'email': company.adminEmail,
        'password': company.adminPassword,
        'firstName': company.adminFirstName,
        'lastName': company.adminLastName,
        'phone': company.adminContact ?? '',
        'country': company.companyCountry ?? '',
        'industry': company.companyIndustry ?? '',
        'size': company.companySize ?? '',
      },
    );

    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> fetchTenants() async {
    final response = await dio.get('/auth/tenants');
    return response.data as Map<String, dynamic>;
  }

  Future<void> approveTenant(String tenantId) async {
    await dio.patch('/auth/tenants/$tenantId/approve');
  }

  Future<void> suspendTenant(String tenantId) async {
    await dio.patch('/auth/tenants/$tenantId/suspend');
  }

  //////////////////////////////////////////////////////
  Future<Map<String, dynamic>> inviteEmployee({
    required String tenantSlug,
    required String email,
    required String firstName,
    required String lastName,
    required String phone,
    required String role,
  }) async {
    final response = await dio.post(
      '/users/invite',
      data: {
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
        'role': role,
      },
    );
    return response.data as Map<String, dynamic>;
  }
}
