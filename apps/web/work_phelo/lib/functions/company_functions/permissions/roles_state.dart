import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'app_module.dart';

class RolesState {
  final List<AppRole> roles;

  const RolesState({this.roles = const []});

  RolesState copyWith({List<AppRole>? roles}) =>
      RolesState(roles: roles ?? this.roles);
}

class RolesNotifier extends StateNotifier<RolesState> {
  RolesNotifier() : super(RolesState());

  void addRole(AppRole role) {
    state = state.copyWith(roles: [...state.roles, role]);
  }

  void updateRole(AppRole role) {
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
    Provider.family<List<AppRole>, String>((ref, tenantSlug) {
  return ref
      .watch(rolesProvider)
      .roles
      .where((r) => r.tenantSlug == tenantSlug)
      .toList();
});