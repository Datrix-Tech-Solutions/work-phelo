import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../work_phelo_login_functions/authentication_service.dart';
import 'company_onboarding_model.dart';

class CompanyState {
  final List<CompanyModel> companies;
  final bool isLoading;
  final String? error;

  const CompanyState({
    this.companies = const [],
    this.isLoading = false,
    this.error,
  });

  CompanyState copyWith({
    List<CompanyModel>? companies,
    bool? isLoading,
    String? error,
  }) {
    return CompanyState(
      companies: companies ?? this.companies,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

final allCompaniesProvider = Provider<List<CompanyModel>>((ref) {
  return ref.watch(companyProvider).companies;
});

final activeCompaniesProvider = Provider<List<CompanyModel>>((ref) {
  return ref
      .watch(companyProvider)
      .companies
      .where((c) => c.status == CompanyStatus.active)
      .toList();
});

final inactiveCompaniesProvider = Provider<List<CompanyModel>>((ref) {
  return ref
      .watch(companyProvider)
      .companies
      .where((c) => c.status == CompanyStatus.inactive)
      .toList();
});

final companyBySlugProvider = Provider.family<CompanyModel?, String>((
  ref,
  slug,
) {
  return ref
      .watch(companyProvider)
      .companies
      .where((c) => c.tenantSlug == slug)
      .firstOrNull;
});

final activeCompanyCountProvider = Provider<int>((ref) {
  return ref.watch(activeCompaniesProvider).length;
});

final inactiveCompanyCountProvider = Provider<int>((ref) {
  return ref.watch(inactiveCompaniesProvider).length;
});

class CompanyNotifier extends StateNotifier<CompanyState> {
  final AuthenticationService _authService;
  CompanyNotifier(this._authService) : super(const CompanyState());

  Future<Map<String, dynamic>> registerCompany(CompanyModel company) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _authService.registerTenant(company: company);

      final newCompany = company.copyWith(
        status: CompanyStatus.pending,
        onboardedDate: DateTime.now(),
      );
      state = state.copyWith(
        companies: [...state.companies, newCompany],
        isLoading: false,
      );

      return result;
    } catch (e) {
      state = state.copyWith(
        error: e.toString().replaceFirst('Exception: ', ''),
        isLoading: false,
      );
      rethrow;
    }
  }

  void addCompany(CompanyModel company) {
    state = state.copyWith(companies: [...state.companies, company]);
  }

  void updateCompany(CompanyModel company) {
    state = state.copyWith(
      companies: state.companies
          .map((c) => c.tenantSlug == company.tenantSlug ? company : c)
          .toList(),
    );
  }

  void updateEnabledModules(String tenantSlug, List<String> modules) {
    state = state.copyWith(
      companies: state.companies
          .map(
            (c) => c.tenantSlug == tenantSlug
                ? c.copyWith(enabledModules: modules)
                : c,
          )
          .toList(),
    );
  }

  void deleteCompany(String tenantSlug) {
    state = state.copyWith(
      companies: state.companies
          .where((c) => c.tenantSlug != tenantSlug)
          .toList(),
    );
  }

  void setStatus(String tenantSlug, CompanyStatus status) {
    state = state.copyWith(
      companies: state.companies
          .map(
            (c) => c.tenantSlug == tenantSlug ? c.copyWith(status: status) : c,
          )
          .toList(),
    );
  }

  Future<void> fetchCompanies() async {
  state = state.copyWith(isLoading: true, error: null);
  try {
    final companies = await _authService.fetchTenants();
    state = state.copyWith(
      companies: companies,
      isLoading: false,
    );
  } catch (e) {
    state = state.copyWith(
      error: e.toString().replaceFirst('Exception: ', ''),
      isLoading: false,
    );
  }
}

  void setActive(String tenantSlug) =>
      setStatus(tenantSlug, CompanyStatus.active);
  void deactivateCompany(String tenantSlug) =>
      setStatus(tenantSlug, CompanyStatus.inactive);
}

// ── Providers ──────────────────────────────────────────────────────────────

final companyProvider = StateNotifierProvider<CompanyNotifier, CompanyState>((
  ref,
) {
  return CompanyNotifier(ref.read(authenticationServiceProvider));
});
