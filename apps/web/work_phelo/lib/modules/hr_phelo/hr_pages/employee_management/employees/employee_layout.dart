import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_components/widgets/custom_lists/employee_grid_card.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import 'employee_page_wigets.dart/onboarding_form.dart';

class EmployeeLayout extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
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

    return EmployeeGridCard(
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
