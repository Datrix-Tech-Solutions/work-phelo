class AppUser {
  final String uid;
  final String email;
  final String fullName;
  final String role;
  final String companyName;
  final String tenantSlug;
  final String companyStatus;
  final DateTime lastLogin;

  const AppUser({
    required this.uid,
    required this.email,
    required this.fullName,
    required this.role,
    required this.companyName,
    required this.tenantSlug,
    required this.companyStatus,
    required this.lastLogin,
  });

  bool get isSuperAdmin => role == 'super_admin';
  bool get isPlatformOwner => role == 'platform_owner';
  bool get isEmployee => role == 'employee';

  factory AppUser.fromMap(Map<String, dynamic> map) {
    return AppUser(
      uid: map['uid'] as String? ?? '',
      email: map['email'] as String? ?? '',
      fullName: map['fullName'] as String? ?? '',
      role: map['role'] as String? ?? 'employee',
      companyName: map['companyName'] as String? ?? '',
      tenantSlug: map['tenantSlug'] as String? ?? '',
      companyStatus: map['companyStatus'] as String? ?? '',
      lastLogin: map['lastLogin'] != null
          ? DateTime.parse(map['lastLogin'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'email': email,
      'fullName': fullName,
      'role': role,
      'companyName': companyName,
      'tenantSlug': tenantSlug,
      'companyStatus': companyStatus,
      'lastLogin': lastLogin.toIso8601String(),
    };
  }

  AppUser copyWith({
    String? uid,
    String? email,
    String? fullName,
    String? role,
    String? companyName,
    String? tenantSlug,
    String? companyStatus,
    DateTime? lastLogin,
  }) {
    return AppUser(
      uid: uid ?? this.uid,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      companyName: companyName ?? this.companyName,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      companyStatus: companyStatus?? this.companyStatus,
      lastLogin: lastLogin ?? this.lastLogin,
    );
  }
}
