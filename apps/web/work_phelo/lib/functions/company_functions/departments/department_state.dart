import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../onboarding_function/onboarding_model.dart';
import '../onboarding_function/user_state.dart';
import 'department_model.dart';

class DepartmentState {
  final List<DepartmentModel> departments;
  final bool isLoading;
  final String? error;

  const DepartmentState({
    this.departments = const [],
    this.isLoading = false,
    this.error,
  });

  DepartmentState copyWith({
    List<DepartmentModel>? departments,
    bool? isLoading,
    String? error,
  }) {
    return DepartmentState(
      departments: departments ?? this.departments,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifier
// ─────────────────────────────────────────────────────────────────────────────

class DepartmentNotifier extends StateNotifier<DepartmentState> {
  final Ref _ref;

  DepartmentNotifier(this._ref) : super(const DepartmentState()); // ← takes Ref

  // ── CRUD ────────────────────────────────────────────────────

  void addDepartment(DepartmentModel department) {
    state = state.copyWith(departments: [...state.departments, department]);
  }

  void updateDepartment(DepartmentModel updated) {
    state = state.copyWith(
      departments: state.departments
          .map((d) => d.id == updated.id ? updated : d)
          .toList(),
    );
  }

  void deleteDepartment(String id) {
    // When deleting, clear department field from all members
    final dept = state.departments.where((d) => d.id == id).firstOrNull;
    if (dept != null) {
      for (final email in dept.memberEmails) {
        _clearUserDepartment(email, dept.name);
      }
    }
    state = state.copyWith(
      departments: state.departments.where((d) => d.id != id).toList(),
    );
  }

  // ── Members ──────────────────────────────────────────────────

  void addMember(String departmentId, String email) {
    final dept = state.departments
        .where((d) => d.id == departmentId)
        .firstOrNull;
    if (dept == null) return;
    _updateById(departmentId, (d) => d.addMember(email));
    _setUserDepartment(email, dept.name); // ← sync UserModel
  }

  void removeMember(String departmentId, String email) {
    final dept = state.departments
        .where((d) => d.id == departmentId)
        .firstOrNull;
    if (dept == null) return;
    _updateById(departmentId, (d) => d.removeMember(email));
    _clearUserDepartment(email, dept.name); // ← sync UserModel
  }

  void addMembers(String departmentId, List<String> emails) {
    final dept = state.departments
        .where((d) => d.id == departmentId)
        .firstOrNull;
    if (dept == null) return;
    _updateById(departmentId, (d) {
      var updated = d;
      for (final email in emails) {
        updated = updated.addMember(email);
      }
      return updated;
    });
    // ← sync all added members
    for (final email in emails) {
      _setUserDepartment(email, dept.name);
    }
  }

  // ── Head ─────────────────────────────────────────────────────

  void setHead(String departmentId, String email) {
    _updateById(departmentId, (d) => d.setHead(email));
  }

  void clearHead(String departmentId) {
    _updateById(departmentId, (d) => d.clearHead());
  }

  // ── Private helpers ───────────────────────────────────────────

  void _updateById(String id, DepartmentModel Function(DepartmentModel) fn) {
    state = state.copyWith(
      departments: state.departments
          .map((d) => d.id == id ? fn(d) : d)
          .toList(),
    );
  }

  // Sets UserModel.department to the department name
  void _setUserDepartment(String email, String departmentName) {
    final userNotifier = _ref.read(userProvider.notifier);
    final user = _ref
        .read(userProvider)
        .users
        .where((u) => u.email == email)
        .firstOrNull;
    if (user == null) return;
    userNotifier.updateUser(user.copyWith(department: departmentName));
  }

  // Clears UserModel.department only if it matches this department
  void _clearUserDepartment(String email, String departmentName) {
    final userNotifier = _ref.read(userProvider.notifier);
    final user = _ref
        .read(userProvider)
        .users
        .where((u) => u.email == email)
        .firstOrNull;
    if (user == null) return;
    // Only clear if the user's department matches — they may belong to another
    if (user.department == departmentName) {
      userNotifier.updateUser(user.copyWith(department: ''));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

final departmentProvider =
    StateNotifierProvider<DepartmentNotifier, DepartmentState>((ref) {
      return DepartmentNotifier(ref);
    });

/// All departments for a specific company.
final departmentsByTenantProvider =
    Provider.family<List<DepartmentModel>, String>((ref, tenantSlug) {
      return ref
          .watch(departmentProvider)
          .departments
          .where((d) => d.tenantSlug == tenantSlug)
          .toList();
    });

/// A single department by id.
final departmentByIdProvider = Provider.family<DepartmentModel?, String>((
  ref,
  id,
) {
  return ref
      .watch(departmentProvider)
      .departments
      .where((d) => d.id == id)
      .firstOrNull;
});

/// Resolved members (UserModel list) for a department.
/// Combines departmentProvider + userProvider — no extra state needed.
final departmentMembersProvider = Provider.family<List<UserModel>, String>((
  ref,
  departmentId,
) {
  final department = ref.watch(departmentByIdProvider(departmentId));
  if (department == null) return [];
  final allUsers = ref.watch(userProvider).users;
  return allUsers
      .where((u) => department.memberEmails.contains(u.email))
      .toList();
});

/// Resolved head (UserModel) for a department.
final departmentHeadProvider = Provider.family<UserModel?, String>((
  ref,
  departmentId,
) {
  final department = ref.watch(departmentByIdProvider(departmentId));
  if (department == null || !department.hasHead) return null;
  return ref
      .watch(userProvider)
      .users
      .where((u) => u.email == department.headEmail)
      .firstOrNull;
});

/// Count of departments for a tenant.
final departmentCountProvider = Provider.family<int, String>((ref, tenantSlug) {
  return ref.watch(departmentsByTenantProvider(tenantSlug)).length;
});
