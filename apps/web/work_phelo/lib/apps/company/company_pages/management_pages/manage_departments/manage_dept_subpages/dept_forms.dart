import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../../Components/App_Theme/text_styles.dart';
import '../../../../../../Functions/company_functions/departments/department_model.dart';
import '../../../../../../Functions/company_functions/departments/department_state.dart';
import '../../../../../../Functions/company_functions/onboarding_function/onboarding_model.dart';

class DepartmentMemberSideBar extends ConsumerStatefulWidget {
  final DepartmentModel dept;
  final AppUser currentUser;
  final List<UserModel> tenantUsers;
  final List<UserModel> currentMembers;

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