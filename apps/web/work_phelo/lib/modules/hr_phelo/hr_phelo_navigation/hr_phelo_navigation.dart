import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_permission_funtions/company_modules_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../work_phelo_components/widgets/custom_lists/navigation.dart';
import '../hr_pages/asset_management/asset_management_layout.dart';
import '../hr_pages/employee_management/appraisal/appraisal_layout.dart';
import '../hr_pages/employee_management/employees/employee_layout.dart';
import '../hr_pages/employee_management/leave_management/leave_management_layout.dart';
import '../hr_pages/employee_management/manage_departments/manage_department_page.dart';
import '../hr_pages/hr_phelo_dashboard/hr_phelo_dashboard_layout.dart';
import '../hr_pages/payroll_compensation/payroll_management_page.dart';
import '../hr_pages/work_force_management/my_schedules/schedules_layout.dart';
import '../hr_pages/work_force_management/my_time/my_time.dart';
import '../hr_pages/work_force_management/projects_tasks/projects_tasks_layout.dart';

// navigation_data.dart
List<NavItem> hrNavigationItems(
  AppUserModel currentUser,

  Set<PermissionModule> accessibleModules,
) => [
  NavSection('Overview'),

  NavDestination(
    icon: Icons.dashboard_outlined,
    title: 'Dashboard',
    pageIndex: 0,
    page: HrPheloDashboardLayout(currentUser: currentUser),
    // no requiredModule — always visible
  ),

  if (accessibleModules.contains(PermissionModule.onboarding))
    NavSection('Employee Management'),

  NavDestination(
    icon: UniconsLine.building,
    title: 'Departments',
    pageIndex: 1,
    page: ManageDepartmentPage(currentUser: currentUser),
    // no requiredModule — always visible
  ),

  if (accessibleModules.contains(PermissionModule.onboarding))
    NavDestination(
      icon: UniconsLine.users_alt,
      title: 'Employees',
      pageIndex: 2,
      page: EmployeeLayout(currentUser: currentUser),
      requiredModule: PermissionModule.onboarding,
      // no requiredModule — always visible
    ),

  // if (accessibleModules.contains(PermissionModule.offboarding))
  //   NavDestination(
  //     icon: UniconsLine.user_minus,
  //     title: 'Offboarding',
  //     pageIndex: 3,
  //     page: const OffboardingLayout(),
  //     requiredModule: PermissionModule.offboarding,
  //   ),
  if (accessibleModules.contains(PermissionModule.leaveManagement))
    NavDestination(
      icon: UniconsLine.calender,
      title: 'Leave Management',
      pageIndex: 3,
      page: LeaveManagementLayout(currentUser: currentUser),
      requiredModule: PermissionModule.leaveManagement,
    ),

  if (accessibleModules.contains(PermissionModule.appraisal))
    NavDestination(
      icon: UniconsLine.check_circle,
      title: 'Appraisal',
      pageIndex: 4,
      page: AppraisalLayout(currentUser: currentUser),
      requiredModule: PermissionModule.appraisal,
    ),

  NavSection('Time Management'),

  NavDestination(
    icon: UniconsLine.clock,
    title: 'TIme Clock',
    pageIndex: 5,
    page: MyTimePlanner(),
  ),
  if (accessibleModules.contains(PermissionModule.onboarding))
    NavDestination(
      icon: UniconsLine.schedule,
      title: 'My Schedules',
      pageIndex: 6,
      page: SchedulesLayout(),
    ),

  if (accessibleModules.contains(PermissionModule.onboarding))
    NavDestination(
      icon: UniconsLine.clipboard_notes,
      title: 'My Projects & Tasks',
      pageIndex: 7,
      page: ProjectsTasksLayout(),
    ),

  if (accessibleModules.contains(PermissionModule.onboarding))
    NavSection('Payroll & Compensation'),

  if (accessibleModules.contains(PermissionModule.onboarding))
    NavDestination(
      icon: UniconsLine.invoice,
      title: 'Payroll',
      pageIndex: 8,
      page: PayrollManagementPage(),
    ),

  if (accessibleModules.contains(PermissionModule.onboarding))
    NavSection('Asset Management'),

  if (accessibleModules.contains(PermissionModule.onboarding))
    NavDestination(
      icon: UniconsLine.monitor,
      title: 'Asset Management',
      pageIndex: 9,
      page: AssetManagementLayout(currentUser: currentUser),
    ),
];
