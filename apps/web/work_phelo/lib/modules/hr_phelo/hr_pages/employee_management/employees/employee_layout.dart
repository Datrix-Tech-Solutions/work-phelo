import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../Functions/company_functions/departments/department_state.dart';
import '../../../../../Functions/company_functions/onboarding_function/user_state.dart';
import '../../../../../components/app_widgets/lists/app_grid.dart';
import '../../../../../components/form_components/my_side_panel.dart';
import 'employee_page_wigets.dart/onboarding_form.dart';

class EmployeeLayout extends ConsumerStatefulWidget {
  final AppUser currentUser;
  const EmployeeLayout({super.key, required this.currentUser});

  @override
  ConsumerState<EmployeeLayout> createState() => _EmployeeLayoutState();
}

class _EmployeeLayoutState extends ConsumerState<EmployeeLayout> {
  String _search = '';
  String? _departmentFilter;
  late final _panel = SidePanelController();
  final _formKey = GlobalKey<OnboardingFormState>();

  @override
  Widget build(BuildContext context) {
    final users = ref.watch(
      usersByTenantProvider(widget.currentUser.tenantSlug),
    );
    final departments = ref.watch(
      departmentsByTenantProvider(widget.currentUser.tenantSlug),
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

    return EmployeeCardGrid(
      users: filtered,
      departments: departments,
      currentUser: widget.currentUser,
      search: _search,
      departmentFilter: _departmentFilter,
      onSearchChanged: (v) => setState(() => _search = v),
      onDepartmentChanged: (v) => setState(() => _departmentFilter = v),

      newEmployee: () => _panel.show(
        context: context,
        formTitle: 'COMPANY ONBOARDING FORM',
        onPressed: () {
          final user = _formKey.currentState?.submit();
          if (user == null) return;
          ref.read(userProvider.notifier).addUser(user);
          _panel.close();
        },
        secOnPressed: () => _formKey.currentState?.reset(),
        child: OnboardingForm(key: _formKey, currentUser: widget.currentUser),
      ),
      onCardTap: (user) {
      },
    );
  }
}
