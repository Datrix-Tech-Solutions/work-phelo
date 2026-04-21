import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../work_phelo_components/widgets/custom_cards/title_card.dart';
import 'hr_phelo_dashboard_widgets.dart/employee_data.dart';

class HrPheloDashboardLayout extends StatelessWidget {
  final AppUserModel currentUser;
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
