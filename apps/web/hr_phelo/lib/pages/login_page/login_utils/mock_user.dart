class MockUser {
  final String email;
  final String password;
  final String fullName;
  final String companyName;
  final String role;
  final bool isActive;

  MockUser({
    required this.email,
    required this.password,
    this.fullName = "Test User",
    this.companyName ='Test Company',
    this.role = "employee",
    this.isActive = true,
  });
}

class MockAuthService {
  static final List<MockUser> _users = [
    MockUser(
      email: "admin@mail.com",
      password: "Admin@12",
      fullName: "Administrator",
      role: "platform_owner",
      companyName: "Datrix Tech Solutions"
    ),
    MockUser(
      email: "john@datrixtechsolutions.com",
      password: "Pass@1234",
      fullName: "John Doe",
      role: "employee",
      companyName: "Datrix Tech Solutions"
    ),
    MockUser(
      email: "sarah@datrixtechsolutions.com",
      password: "sarah2025",
      fullName: "Sarah Connor",
      role: "employee",
      companyName: "Datrix Tech Solutions"
    ),
    MockUser(
      email: "support@datrixtechsolutions.com",
      password: "Helpme2026",
      fullName: "Support Team",
      role: "company",
      companyName: "Datrix Tech Solutions"
    ),
  ];

  static Future<Map<String, dynamic>?> login({
    required String email,
    required String password,
  }) async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 1400));

    final trimmedEmail = email.trim().toLowerCase();
    final user = _users.cast<MockUser?>().firstWhere(
      (u) => u?.email.toLowerCase() == trimmedEmail && u?.password == password,
      orElse: () => null,
    );

    if (user == null) {
      return null;
    }

    if (!user.isActive) {
      throw Exception("Account is deactivated");
    }

    return {
      "uid": "mock_${trimmedEmail.hashCode}",
      "email": user.email,
      "fullName": user.fullName,
      "role": user.role,
      "companyName": user.companyName,
      "lastLogin": DateTime.now().toIso8601String(),
    };
  }
}
