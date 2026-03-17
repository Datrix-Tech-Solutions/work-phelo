import 'package:flutter/material.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_pages/hr_people_management/appraisal/appraisal_layout.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_pages/hr_people_management/employees/employee_layout.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_pages/hr_people_management/leave_management/leave_management_layout.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_pages/hr_people_management/offboarding/offboarding_layout.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_pages/hr_people_management/onboarding/onboarding_layout.dart';
import 'package:unicons/unicons.dart';

import '../hr_pages/hr_phelo_dashboard/hr_phelo_dashboard_layout.dart';

sealed class NavItem {
  const NavItem();
}

class NavSection extends NavItem {
  final String title;
  const NavSection(this.title);
}

class NavDestination extends NavItem {
  final IconData icon;
  final String title;
  final int pageIndex;
  final Widget page;

  const NavDestination({
    required this.icon,
    required this.title,
    required this.pageIndex,
    required this.page,
  });
}

// navigation_data.dart
final List<NavItem> navigationItems = [
  NavSection('Core Features'),

  NavDestination(
    icon: UniconsLine.estate,
    title: 'Dashboard',
    pageIndex: 0,
    page: const HrPheloDashboardLayout(),
  ),

  NavSection('Employee Management'),

  NavDestination(
    icon: UniconsLine.users_alt,
    title: 'Employees',
    pageIndex: 1,
    page: const EmployeeLayout(),
  ),
  NavDestination(
    icon: UniconsLine.user_plus,
    title: 'Onboarding',
    pageIndex: 2,
    page: const OnboardingLayout(),
  ),
  NavDestination(
    icon: UniconsLine.user_minus,
    title: 'Offboarding',
    pageIndex: 3,
    page: const OffboardingLayout(),
  ),
  NavDestination(
    icon: UniconsLine.calender,
    title: 'Leave Management',
    pageIndex: 4,
    page: const LeaveManagementLayout(),
  ),
  NavDestination(
    icon: UniconsLine.check_circle,
    title: 'Appraisal',
    pageIndex: 5,
    page: const AppraisalLayout(),
  ),
];
