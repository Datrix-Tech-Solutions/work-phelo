import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/app_theme/colors.dart';
import 'package:hr_phelo/pages/dashboard/dashboard.dart';
import 'package:hr_phelo/pages/home/home_page.dart';
import 'package:hr_phelo/pages/login_page/login_form_types.dart/login_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      routes: {
        '/admin_dashboard': (context) => DashboardPage(),
        '/company_dashboard': (context) => DashboardPage(),
        '/home': (context) => EmployeeHomePage(),
        '/login': (context) => LoginPage(),
      },
      title: 'Work Phelo',
      debugShowCheckedModeBanner: false,
      theme: lightTheme,
      // darkTheme: darkTheme,
      home: LoginPage(),
    );
  }
}
