import 'package:flutter/material.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_pages/hr_phelo_dashboard/hr_phelo_dashboard_widgets.dart/employee_data.dart';
import 'package:hr_phelo/components/app_widgets/cards/title_card.dart';

class HrPheloDashboardLayout extends StatelessWidget {
  const HrPheloDashboardLayout({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Flexible(
          child: WelcomeCard(
            welcomeText: 'Welcome Back, Username',
            date: '${DateTime.now()}',
          ),
        ),
        Flexible(child: EmployeeDataSummary()),
        Flexible(child: Text('data')),
      ],
    );
  }
}
