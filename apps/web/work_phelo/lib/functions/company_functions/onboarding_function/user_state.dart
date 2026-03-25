// ── State ──────────────────────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'onboarding_model.dart';

class UserState {
  final List<UserModel> users;
  final bool isLoading;
  final String? error;

  const UserState({this.users = const [], this.isLoading = false, this.error});

  UserState copyWith({List<UserModel>? users, bool? isLoading, String? error}) {
    return UserState(
      users: users ?? this.users,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

// ── Notifier ───────────────────────────────────────────────────────────────

class UserNotifier extends StateNotifier<UserState> {
  UserNotifier() : super(const UserState());

  void addUser(UserModel user) {
    state = state.copyWith(users: [...state.users, user]);
  }

  void updateUser(UserModel updated) {
    state = state.copyWith(
      users: state.users.map((u) {
        return u.email == updated.email ? updated : u;
      }).toList(),
    );
  }

  void removeUser(String email) {
    state = state.copyWith(
      users: state.users.where((u) => u.email != email).toList(),
    );
  }

  void checkAndResetLeave(int defaultLeaveDays) {
  final now = DateTime.now();
  final updated = state.users.map((u) {
    final anniversary = DateTime(now.year, u.hiredDate.month, u.hiredDate.day);
    final lastReset = u.lastLeaveReset;

    final shouldReset = !now.isBefore(anniversary) &&
        (lastReset == null || lastReset.year < now.year);

    if (shouldReset) {
      return u.copyWith(
        leaveDays: defaultLeaveDays,
        lastLeaveReset: now,
      );
    }
    return u;
  }).toList();
  state = state.copyWith(users: updated);
}

  void deductLeave(String email, int days) {
    state = state.copyWith(
      users: state.users.map((u) {
        if (u.email != email) return u;
        final remaining = (u.leaveDays ?? 0) - days;
        return u.copyWith(leaveDays: remaining < 0 ? 0 : remaining);
      }).toList(),
    );
  }

  int daysUntilReset(UserModel user) {
    final now = DateTime.now();
    final next = _nextAnniversary(user.hiredDate, now);
    return next.difference(now).inDays;
  }

  // ── Status methods ──────────────────────────────────────────

  void setStatus(String email, EmploymentStatus status) {
    state = state.copyWith(
      users: state.users.map((u) {
        return u.email == email ? u.copyWith(status: status) : u;
      }).toList(),
    );
  }

  void setActive(String email) => setStatus(email, EmploymentStatus.active);
  void setOnLeave(String email) => setStatus(email, EmploymentStatus.onLeave);
  void deactivateUser(String email) =>
      setStatus(email, EmploymentStatus.inactive);

  // ── Private helpers ─────────────────────────────────────────

  DateTime _nextAnniversary(DateTime hiredDate, DateTime now) {
    var anniversary = DateTime(now.year, hiredDate.month, hiredDate.day);
    if (!anniversary.isAfter(now)) {
      anniversary = DateTime(now.year + 1, hiredDate.month, hiredDate.day);
    }
    return anniversary;
  }
}

// ── Providers ──────────────────────────────────────────────────────────────

final userProvider = StateNotifierProvider<UserNotifier, UserState>((ref) {
  return UserNotifier();
});

final allUsersProvider = Provider<List<UserModel>>((ref) {
  return ref.watch(userProvider).users;
});

final activeUsersProvider = Provider<List<UserModel>>((ref) {
  return ref
      .watch(userProvider)
      .users
      .where((u) => u.status == EmploymentStatus.active)
      .toList();
});

final onLeaveUsersProvider = Provider<List<UserModel>>((ref) {
  return ref
      .watch(userProvider)
      .users
      .where((u) => u.status == EmploymentStatus.onLeave)
      .toList();
});

final userByEmailProvider = Provider.family<UserModel?, String>((ref, email) {
  return ref
      .watch(userProvider)
      .users
      .where((u) => u.email == email)
      .firstOrNull;
});

final onLeaveCountProvider = Provider<int>((ref) {
  return ref.watch(onLeaveUsersProvider).length;
});

final usersByTenantProvider = Provider.family<List<UserModel>, String>((
  ref,
  tenantSlug,
) {
  return ref
      .watch(userProvider)
      .users
      .where((u) => u.tenantSlug == tenantSlug)
      .toList();
});

final activeUsersByTenantProvider = Provider.family<List<UserModel>, String>((
  ref,
  tenantSlug,
) {
  return ref
      .watch(usersByTenantProvider(tenantSlug))
      .where((u) => u.status == EmploymentStatus.active)
      .toList();
});

final onLeaveUsersByTenantProvider = Provider.family<List<UserModel>, String>((
  ref,
  tenantSlug,
) {
  return ref
      .watch(usersByTenantProvider(tenantSlug))
      .where((u) => u.status == EmploymentStatus.onLeave)
      .toList();
});

/// Total headcount for a specific tenant (all statuses).
final tenantEmployeeCountProvider = Provider.family<int, String>((
  ref,
  tenantSlug,
) {
  return ref.watch(usersByTenantProvider(tenantSlug)).length;
});
