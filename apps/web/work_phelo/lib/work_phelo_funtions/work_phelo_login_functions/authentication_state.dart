import 'dart:developer';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../../routings/go_routes.dart';
import '../work_phelo_users/user_model.dart';
import 'authentication_service.dart';

class AuthenticationState {
  final AppUserModel? user;
  final bool isLoading;
  final String? error;

  const AuthenticationState({this.user, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;

  AuthenticationState copyWith({
    AppUserModel? user,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return AuthenticationState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthenticationState> {
  final AuthenticationService _service;
  final Ref ref;

  AuthNotifier(this._service, this.ref) : super(const AuthenticationState());

  // Super Admin Login
  Future<void> loginSuperAdmin({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final user = await _service.loginSuperAdmin(
        email: email,
        password: password,
      );
      state = state.copyWith(user: user, isLoading: false);
    } catch (e) {
      String msg = 'An error occurred. Please try again.';
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map && data['message'] != null) {
          msg = data['message'].toString();
        }
      }
      state = state.copyWith(error: msg, isLoading: false);
    }
  }

  // Tenant Login
  Future<void> loginTenant({
    required String tenantSlug,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    log('TENANT AUTH >> login started, slug: $tenantSlug');

    try {
      final user = await _service
          .loginTenant(tenantSlug: tenantSlug, email: email, password: password)
          .timeout(
            const Duration(seconds: 15),
            onTimeout: () {
              log('TENANT AUTH >> TIMED OUT after 15 seconds');
              throw Exception('Request timed out. Check your connection.');
            },
          );
      log('TENANT AUTH >> user received: ${user.email} role: ${user.role}');
      state = state.copyWith(user: user, isLoading: false);
      log(
        'TENANT AUTH >> state updated: isAuthenticated=${state.isAuthenticated}, isLoading=${state.isLoading}',
      );
    } catch (e) {
      log('TENANT AUTH >> error: $e');
      state = state.copyWith(
        error: e.toString().replaceFirst('Exception: ', ''),
        isLoading: false,
      );
    }
  }

  Future<void> logout() async {
    final tenantSlug = state.user?.tenantSlug;
    final isSuperAdmin = state.user?.isSuperAdmin ?? false;
    log('LOGOUT >> tenantSlug: ${state.user?.tenantSlug}');
    log('LOGOUT >> user: ${state.user?.email}');
    log('LOGOUT >> isSuperAdmin: ${state.user?.isSuperAdmin}');

    await _service.logout();
    state = const AuthenticationState();

    // ── Route back to the correct login page ──
    if (isSuperAdmin) {
      ref.read(goRouterProvider).go('/platform/login');
    } else if (tenantSlug != null && tenantSlug.isNotEmpty) {
      ref.read(goRouterProvider).go('/$tenantSlug/login');
    }
  }

  void clearUser() {
    log('CLEAR USER CALLED');
    // Print the stack trace to see exactly what called it
    log(StackTrace.current.toString());
    state = const AuthenticationState();
  }
}

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AuthenticationState>((ref) {
      return AuthNotifier(ref.read(authenticationServiceProvider), ref);
    });
