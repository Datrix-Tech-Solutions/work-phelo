import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import 'apps/company/dashboard/company_dashboard.dart';
import 'apps/super_admin/super_admin_layout.dart';
import 'modules/dashboard.dart';
import 'pages/get_started.dart';
import 'pages/login_page/login_form_types.dart/login_page.dart';
import 'work_phelo_components/theme/app.colors.dart';

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
          if (args is AppUserModel) {
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
