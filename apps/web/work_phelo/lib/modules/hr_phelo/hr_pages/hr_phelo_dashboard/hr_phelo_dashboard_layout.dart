import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../components/app_widgets/cards/title_card.dart';
import 'hr_phelo_dashboard_widgets.dart/employee_data.dart';

class HrPheloDashboardLayout extends StatelessWidget {
  final AppUser currentUser;
  const HrPheloDashboardLayout({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          children: [
            WelcomeCard(
              welcomeText: 'Welcome Back, ${currentUser.fullName}',
              date: DateFormat('EEEE, MMMM d, y').format(DateTime.now()),
            ),
            EmployeeDataSummary(currentUser: currentUser),
          ],
        ),
      ),
    );
  }
}
