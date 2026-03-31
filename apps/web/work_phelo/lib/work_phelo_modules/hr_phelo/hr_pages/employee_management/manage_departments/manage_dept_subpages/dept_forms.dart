import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

import '../../../../../../work_phelo_components/theme/app_text_theme.dart';


class DepartmentMemberSideBar extends ConsumerStatefulWidget {
  final CompanyDepartmentsModel dept;
  final AppUserModel currentUser;
  final List<EmployeeModel> tenantUsers;
  final List<EmployeeModel> currentMembers;

  const DepartmentMemberSideBar({
    super.key,
    required this.dept,
    required this.currentMembers,
    required this.tenantUsers,
    required this.currentUser,
  });

  @override
  ConsumerState<DepartmentMemberSideBar> createState() =>
      DepartmentMemberSideBarState();
}

class DepartmentMemberSideBarState
    extends ConsumerState<DepartmentMemberSideBar> {
  final Set<String> _selected = {};

  // Called externally by the panel's submit button
  void submit() {
    if (_selected.isEmpty) return;
    ref
        .read(departmentProvider.notifier)
        .addMembers(widget.dept.id, _selected.toList());
  }

  void reset() => setState(() => _selected.clear());

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    // Filter out employees who are already members
    final currentEmails =
        widget.currentMembers.map((u) => u.email).toSet();
    final available = widget.tenantUsers
        .where((u) => !currentEmails.contains(u.email))
        .toList();

    if (available.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Text(
            'All employees are already members of this department.',
            style: myMainTextStyle(context)
                .copyWith(color: cs.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: available.length,
      separatorBuilder: (_, _) =>
          Divider(height: 1, color: cs.outlineVariant),
      itemBuilder: (context, index) {
        final u = available[index];
        final isSelected = _selected.contains(u.email);

        return CheckboxListTile(
          value: isSelected,
          onChanged: (v) => setState(
            () => v == true
                ? _selected.add(u.email)
                : _selected.remove(u.email),
          ),
          title: Text(
            u.fullName,
            style: myMainTextStyle(context)
                .copyWith(fontWeight: FontWeight.w500),
          ),
          subtitle: Text(
            u.jobTitle,
            style: myMainTextStyle(context)
                .copyWith(fontSize: 11, color: cs.onSurfaceVariant),
          ),
          secondary: CircleAvatar(
            backgroundColor: cs.primaryContainer,
            child: Text(
              '${u.firstName[0]}${u.lastName[0]}',
              style: TextStyle(
                fontSize: 11,
                color: cs.onPrimaryContainer,
              ),
            ),
          ),
          activeColor: widget.dept.color,
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        );
      },
    );
  }
}