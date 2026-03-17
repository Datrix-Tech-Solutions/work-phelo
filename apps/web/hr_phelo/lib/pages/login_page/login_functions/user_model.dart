class AppUser {
  final String uid;
  final String email;
  final String fullName;
  final String role;
  final String companyName;
  final DateTime lastLogin;

  const AppUser({
    required this.uid,
    required this.email,
    required this.fullName,
    required this.role,
    required this.companyName,
    required this.lastLogin,
  });

  factory AppUser.fromMap(Map<String, dynamic> map) {
    return AppUser(
      uid: map['uid'] as String,
      email: map['email'] as String,
      fullName: map['fullName'] as String,
      role: map['role'] as String,
      companyName: map['companyName'] as String,
      lastLogin: DateTime.parse(map['lastLogin'] as String),
    );
  }

  String get displayName =>
      fullName.isNotEmpty ? fullName : email.split('@').first;
}
