import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'company_modules_model.dart';

class RolesState {
  final List<EmployeePermission> roles;

  const RolesState({this.roles = const []});

  RolesState copyWith({List<EmployeePermission>? roles}) =>
      RolesState(roles: roles ?? this.roles);
}

class RolesNotifier extends StateNotifier<RolesState> {
  RolesNotifier() : super(RolesState());

  void addRole(EmployeePermission role) {
    state = state.copyWith(roles: [...state.roles, role]);
  }

  void updateRole(EmployeePermission role) {
    state = state.copyWith(
      roles: state.roles.map((r) => r.id == role.id ? role : r).toList(),
    );
  }

  void deleteRole(String id) {
    state = state.copyWith(
      roles: state.roles.where((r) => r.id != id).toList(),
    );
  }
}

final rolesProvider = StateNotifierProvider<RolesNotifier, RolesState>((ref) {
  return RolesNotifier();
});
final rolesByTenantProvider =
    Provider.family<List<EmployeePermission>, String>((ref, tenantSlug) {
  return ref
      .watch(rolesProvider)
      .roles
      .where((r) => r.tenantSlug == tenantSlug)
      .toList();
});