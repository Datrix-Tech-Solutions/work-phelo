import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'apps/company/dashboard/company_dashboard.dart';
import 'apps/super_admin/super_admin_layout.dart';
import 'components/app_theme/colors.dart';
import 'functions/app_users/app_user_model.dart';
import 'modules/dashboard.dart';
import 'pages/get_started.dart';
import 'pages/login_page/login_form_types.dart/login_page.dart';

void main() {
  runApp(ProviderScope(child: const MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      routes: {
        '/platform/dashboard': (context) => SuperAdminLayout(),
        '/dashboard': (context) => CompanyDashboard(),
        '/home': (context) => DashboardPage(),
        '/login': (context) => LoginPage(),
        '/get-started': (context) {
  final args = ModalRoute.of(context)?.settings.arguments;
  if (args is AppUser) {
    return GetStartedPage(currentUser: args);
  }
  return const LoginPage();
},
      },
      title: 'Work Phelo',
      debugShowCheckedModeBanner: false,
      theme: lightTheme,
      // theme: darkTheme,
      home: LoginPage(),
    );
  }
}
