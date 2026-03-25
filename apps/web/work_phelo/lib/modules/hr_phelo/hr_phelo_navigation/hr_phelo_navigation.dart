import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../Functions/company_functions/permissions/app_module.dart';
import '../../../components/app_widgets/lists/navigation.dart';
import '../hr_pages/asset_management/asset_management_layout.dart';
import '../hr_pages/employee_management/appraisal/appraisal_layout.dart';
import '../hr_pages/employee_management/employees/employee_layout.dart';
import '../hr_pages/employee_management/leave_management/leave_management_layout.dart';
import '../hr_pages/employee_management/my_data_page/my_data_page_layout.dart';
import '../hr_pages/employee_management/offboarding/offboarding_layout.dart';
import '../hr_pages/hr_phelo_dashboard/hr_phelo_dashboard_layout.dart';
import '../hr_pages/payroll_compensation/payroll_management_page.dart';
import '../hr_pages/work_force_management/my_schedules/schedules_layout.dart';
import '../hr_pages/work_force_management/my_time/my_time.dart';
import '../hr_pages/work_force_management/projects_tasks/projects_tasks_layout.dart';

// navigation_data.dart
List<NavItem> hrNavigationItems(
  AppUser currentUser,
  Set<AppModule> accessibleModules,
) => [
  NavSection('Overview'),

  NavDestination(
    icon: Icons.dashboard_outlined,
    title: 'Dashboard',
    pageIndex: 0,
    page: HrPheloDashboardLayout(currentUser: currentUser),
    // no requiredModule — always visible
  ),

  NavDestination(
    icon: UniconsLine.user_circle,
    title: 'My Data',
    pageIndex: 1,
    page: MyDataPageLayout(),
    // no requiredModule — always visible
  ),

  if (accessibleModules.contains(AppModule.onboarding))
    NavSection('Employee Management'),

  if (accessibleModules.contains(AppModule.onboarding))
    NavDestination(
      icon: UniconsLine.users_alt,
      title: 'Employees',
      pageIndex: 2,
      page: EmployeeLayout(currentUser: currentUser),
      requiredModule: AppModule.onboarding,
      // no requiredModule — always visible
    ),

  if (accessibleModules.contains(AppModule.offboarding))
    NavDestination(
      icon: UniconsLine.user_minus,
      title: 'Offboarding',
      pageIndex: 3,
      page: const OffboardingLayout(),
      requiredModule: AppModule.offboarding,
    ),

  if (accessibleModules.contains(AppModule.leaveManagement))
    NavDestination(
      icon: UniconsLine.calender,
      title: 'Leave Management',
      pageIndex: 4,
      page: LeaveManagementLayout(currentUser: currentUser),
      requiredModule: AppModule.leaveManagement,
    ),

  if (accessibleModules.contains(AppModule.appraisal))
    NavDestination(
      icon: UniconsLine.check_circle,
      title: 'Appraisal',
      pageIndex: 5,
      page: const AppraisalLayout(),
      requiredModule: AppModule.appraisal,
    ),

  NavSection('Time Management'),

  NavDestination(
    icon: UniconsLine.clock,
    title: 'TIme Clock',
    pageIndex: 6,
    page: MyTimePlanner(),
  ),
  NavDestination(
    icon: UniconsLine.schedule,
    title: 'My Schedules',
    pageIndex: 7,
    page: SchedulesLayout(),
  ),
  NavDestination(
    icon: UniconsLine.clipboard_notes,
    title: 'My Projects & Tasks',
    pageIndex: 8,
    page: ProjectsTasksLayout(),
  ),

  NavSection('Payroll & Compensation'),

  NavDestination(
    icon: UniconsLine.invoice,
    title: 'Payroll',
    pageIndex: 9,
    page: PayrollManagementPage(),
  ),

  NavSection('Asset Management'),

  NavDestination(
    icon: UniconsLine.monitor,
    title: 'Asset Management',
    pageIndex: 10,
    page: AssetManagementLayout(),
  ),
];
