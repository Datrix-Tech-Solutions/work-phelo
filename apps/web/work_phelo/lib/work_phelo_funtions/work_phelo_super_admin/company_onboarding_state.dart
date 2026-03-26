import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

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
  CompanyNotifier() : super(const CompanyState());

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
    companies: state.companies.map((c) =>
      c.tenantSlug == tenantSlug
          ? c.copyWith(enabledModules: modules)
          : c,
    ).toList(),
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

  void setActive(String tenantSlug) =>
      setStatus(tenantSlug, CompanyStatus.active);
  void deactivateCompany(String tenantSlug) =>
      setStatus(tenantSlug, CompanyStatus.inactive);
}

// ── Providers ──────────────────────────────────────────────────────────────

final companyProvider = StateNotifierProvider<CompanyNotifier, CompanyState>((
  ref,
) {
  return CompanyNotifier(); // no repo needed
});

// // ── Notifier ───────────────────────────────────────────────────────────────

// class CompanyNotifier extends StateNotifier<CompanyState> {
//   final CompanyRepository _repo;

//   CompanyNotifier(this._repo) : super(const CompanyState()) {
//     fetchCompanies();
//   }

//   Future<void> fetchCompanies() async {
//     state = state.copyWith(isLoading: true, error: null);
//     try {
//       final companies = await _repo.getCompanies();
//       state = state.copyWith(companies: companies, isLoading: false);
//     } catch (e) {
//       state = state.copyWith(isLoading: false, error: e.toString());
//     }
//   }

//   Future<void> addCompany(CompanyModel company) async {
//     state = state.copyWith(isLoading: true, error: null);
//     try {
//       final created = await _repo.addCompany(company);
//       state = state.copyWith(
//         companies: [...state.companies, created],
//         isLoading: false,
//       );
//     } catch (e) {
//       state = state.copyWith(isLoading: false, error: e.toString());
//     }
//   }

//   Future<void> updateCompany(CompanyModel company) async {
//     state = state.copyWith(isLoading: true, error: null);
//     try {
//       final updated = await _repo.updateCompany(company);
//       state = state.copyWith(
//         companies: state.companies
//             .map((c) => c.tenantSlug == updated.tenantSlug ? updated : c)
//             .toList(),
//         isLoading: false,
//       );
//     } catch (e) {
//       state = state.copyWith(isLoading: false, error: e.toString());
//     }
//   }

//   Future<void> deleteCompany(String tenantSlug) async {
//     state = state.copyWith(isLoading: true, error: null);
//     try {
//       await _repo.deleteCompany(tenantSlug);
//       state = state.copyWith(
//         companies: state.companies
//             .where((c) => c.tenantSlug != tenantSlug)
//             .toList(),
//         isLoading: false,
//       );
//     } catch (e) {
//       state = state.copyWith(isLoading: false, error: e.toString());
//     }
//   }

//   void setStatus(String tenantSlug, CompanyStatus status) {
//     state = state.copyWith(
//       companies: state.companies.map((c) {
//         return c.tenantSlug == tenantSlug ? c.copyWith(status: status) : c;
//       }).toList(),
//     );
//   }

//   void setActive(String tenantSlug) =>
//       setStatus(tenantSlug, CompanyStatus.active);

//   void deactivateCompany(String tenantSlug) =>
//       setStatus(tenantSlug, CompanyStatus.inactive);
// }

// // ── Providers ──────────────────────────────────────────────────────────────

// final companyProvider =
//     StateNotifierProvider<CompanyNotifier, CompanyState>((ref) {
//   return CompanyNotifier(ref.watch(companyRepositoryProvider));
// });
