import 'package:flutter_riverpod/legacy.dart';

import '../work_phelo_users/user_model.dart';
import 'authentication_service.dart';

class AuthenticationState {
  final AppUserModel? user;
  final bool isLoading;
  final String? error;

  const AuthenticationState({this.user, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;

  AuthenticationState copyWith({AppUserModel? user, bool? isLoading, String? error}) {
    return AuthenticationState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthenticationState> {
  final AuthenticationService _service;

  AuthNotifier(this._service) : super(const AuthenticationState());

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await _service.login(email: email, password: password);
      state = state.copyWith(user: user, isLoading: false);
      
    } catch (e) {
      state = state.copyWith(
        error: e.toString().replaceFirst('Exception: ', ''),
        isLoading: false,
      );
    }
  }

  Future<void> logout() async {
    
    await _service.logout();
    state = const AuthenticationState();
  }
}

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthenticationState>((
  ref,
) {
  return AuthNotifier(ref.read(authenticationServiceProvider));
});
