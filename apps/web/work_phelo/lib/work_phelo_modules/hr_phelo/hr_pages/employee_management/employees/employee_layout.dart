import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_modules/hr_phelo/hr_pages/employee_management/employees/employee_page_wigets.dart/employee_grid_card.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import '../../../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import '../../../../../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import 'employee_page_wigets.dart/employee_details.dart';
import 'employee_page_wigets.dart/employee_forms/onboarding_form.dart';

class EmployeeLayout extends ConsumerStatefulWidget {
  const EmployeeLayout({super.key});

  @override
  ConsumerState<EmployeeLayout> createState() => _EmployeeLayoutState();
}

class _EmployeeLayoutState extends ConsumerState<EmployeeLayout> {
  String _search = '';
  String? _departmentFilter;
  EmployeeModel? _selectedEmployee;
  late final _panel = SidePanelController();
  final _formKey = GlobalKey<OnboardingFormState>();

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;
    final users = ref.watch(usersByTenantProvider(currentUser!.tenantSlug));
    final departments = ref.watch(
      departmentsByTenantProvider(currentUser.tenantSlug),
    );

    final filtered = users.where((u) {
      final matchesSearch =
          _search.isEmpty ||
          u.fullName.toLowerCase().contains(_search.toLowerCase()) ||
          u.email.toLowerCase().contains(_search.toLowerCase()) ||
          u.jobTitle.toLowerCase().contains(_search.toLowerCase());

      final matchesDept =
          _departmentFilter == null ||
          _departmentFilter == 'All departments' ||
          u.department == _departmentFilter;

      return matchesSearch && matchesDept;
    }).toList();

    return _selectedEmployee == null
        ? EmployeeGridCard(
            users: filtered,
            departments: departments,
            currentUser: currentUser,
            search: _search,
            departmentFilter: _departmentFilter,
            onSearchChanged: (v) => setState(() => _search = v),
            onDepartmentChanged: (v) => setState(() => _departmentFilter = v),

            newEmployee: () => _panel.show(
              context: context,
              formTitle: 'Company Onboarding Form',
              onPressed: () async {
                final user = await _formKey.currentState?.submit();
                if (user == null) return;
                _panel.close();
              },
              secOnPressed: () => _formKey.currentState?.reset(),
              child: OnboardingForm(key: _formKey),
            ),
            onCardTap: (user) {
              setState(() => _selectedEmployee = user);
            },
          )
        : EmployeeDetailsPage(
            employee: _selectedEmployee!,
            ref: ref,
            onBack: () => setState(() => _selectedEmployee = null),
          );
  }
}
