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

  Future<String?> refreshToken() async {
    try {
      final response = await dio.post('/auth/refresh');
      return response.data['access_token'] as String?;
    } catch (_) {
      return null;
    }
  }

  //register company api call
  Future<Map<String, dynamic>> registerTenant({
    required CompanyModel company,
  }) async {
    final response = await dio.post(
      '/tenants/register',
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
    final response = await dio.get('/tenants');
    return response.data as Map<String, dynamic>;
  }
}
