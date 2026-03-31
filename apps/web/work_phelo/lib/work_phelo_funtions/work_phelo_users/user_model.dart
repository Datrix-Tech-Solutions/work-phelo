
class AppUserModel {
  final String uid;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final String companyName;
  final String tenantSlug;
  final String tenantId;
  final String companyStatus;
  final DateTime lastLogin;

  const AppUserModel({
    required this.uid,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.companyName,
    required this.tenantSlug,
    required this.tenantId,
    required this.companyStatus,
    required this.lastLogin,
  });

  bool get isSuperAdmin => role == 'SUPER_ADMIN';
  bool get isPlatformOwner => role == 'TENANT_ADMIN';
  bool get isEmployee => role == 'EMPLOYEE';
  String get fullName => '$firstName $lastName'.trim();

  factory AppUserModel.fromLoginResponse(
    Map<String, dynamic> userData, {
    String tenantSlug = '',
    String companyName = '',
  }) {
    return AppUserModel(
      uid: userData['id'] as String? ?? '',
      email: userData['email'] as String? ?? '',
      firstName: userData['firstName'] as String? ?? '',
      lastName: userData['lastName'] as String? ?? '',
      role: (userData['role'] as String? ?? 'EMPLOYEE').toUpperCase(),
      tenantId: userData['tenantId'] as String? ?? '',
      tenantSlug: tenantSlug,
      companyName: companyName,
      companyStatus: 'active',
      lastLogin: DateTime.now(),
    );
  }

  factory AppUserModel.fromMap(Map<String, dynamic> map) {
    return AppUserModel(
      uid: map['uid'] as String? ?? '',
      email: map['email'] as String? ?? '',
      firstName: map['firstName'] as String? ?? '',
      lastName: map['lastName'] as String? ?? '',
      role: map['role'] as String? ?? 'EMPLOYEE',
      companyName: map['companyName'] as String? ?? '',
      tenantSlug: map['tenantSlug'] as String? ?? '',
      tenantId: map['tenantId'] as String? ?? '',
      companyStatus: map['companyStatus'] as String? ?? 'active',
      lastLogin: map['lastLogin'] != null
          ? DateTime.parse(map['lastLogin'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
    'uid': uid,
    'email': email,
    'firstName': firstName,
    'lastName': lastName,
    'role': role,
    'companyName': companyName,
    'tenantSlug': tenantSlug,
    'tenantId': tenantId,
    'companyStatus': companyStatus,
    'lastLogin': lastLogin.toIso8601String(),
  };

  AppUserModel copyWith({
    String? uid, String? email, String? firstName, String? lastName,
    String? role, String? companyName, String? tenantSlug, String? tenantId,
    String? companyStatus, DateTime? lastLogin,
  }) {
    return AppUserModel(
      uid: uid ?? this.uid,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      role: role ?? this.role,
      companyName: companyName ?? this.companyName,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      tenantId: tenantId ?? this.tenantId,
      companyStatus: companyStatus ?? this.companyStatus,
      lastLogin: lastLogin ?? this.lastLogin,
    );
  }
}