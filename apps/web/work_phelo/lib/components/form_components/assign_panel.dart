import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';

import '../../Components/App_Theme/text_styles.dart';
import '../../Functions/company_functions/departments/department_model.dart';
import '../../Functions/company_functions/departments/department_state.dart';
import '../../Functions/company_functions/onboarding_function/onboarding_model.dart';
import '../../Functions/company_functions/onboarding_function/user_state.dart';
import '../../Functions/company_functions/permissions/app_module.dart';
import '../App_Theme/misc.dart';
import '../app_widgets/lists/chip_card.dart';
import 'my_buttons.dart';

enum AssignPanelMode { roles, departments }

class AssignPanel extends ConsumerStatefulWidget {
  final UserModel user;
  final List<AppRole> roles;
  final List<DepartmentModel> departments;
  final AssignPanelMode mode;
  final VoidCallback onChanged;

  const AssignPanel({
    super.key,
    required this.user,
    required this.onChanged,
    this.roles = const [],
    this.departments = const [],
    this.mode = AssignPanelMode.roles,
  });

  @override
  ConsumerState<AssignPanel> createState() => AssignPanelState();
}

class AssignPanelState extends ConsumerState<AssignPanel> {
  late Set<String> _selectedRoleIds;
  late Set<String> _selectedDeptIds;

  @override
  void initState() {
    super.initState();
    _selectedRoleIds = Set.from(widget.user.systemRole);
    _selectedDeptIds = _resolveCurrentDepts();
  }

  @override
  void didUpdateWidget(AssignPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.email != widget.user.email) {
      _selectedRoleIds = Set.from(widget.user.systemRole);
      _selectedDeptIds = _resolveCurrentDepts();
    }
  }

  // Find which departments this user is already a member of
  Set<String> _resolveCurrentDepts() {
    return widget.departments
        .where((d) => d.memberEmails.contains(widget.user.email))
        .map((d) => d.id)
        .toSet();
  }

  void _save() {
  if (widget.mode == AssignPanelMode.roles) {
    ref.read(userProvider.notifier).updateUser(
      widget.user.copyWith(
        systemRole: _selectedRoleIds.toList(),
      ),
    );
  } else {
    final notifier = ref.read(departmentProvider.notifier);
    final previouslySelected = _resolveCurrentDepts();

    for (final dept in widget.departments) {
      final wasSelected = previouslySelected.contains(dept.id);
      final isNowSelected = _selectedDeptIds.contains(dept.id);

      if (!wasSelected && isNowSelected) {
        notifier.addMember(dept.id, widget.user.email);
      } else if (wasSelected && !isNowSelected) {
        notifier.removeMember(dept.id, widget.user.email);
      }
    }
  }
  widget.onChanged();
}

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isRoles = widget.mode == AssignPanelMode.roles;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Header — user info ────────────────────────────
        Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: cs.primaryContainer,
              child: Text(
                widget.user.fullName
                    .trim()
                    .split(' ')
                    .map((e) => e[0])
                    .take(2)
                    .join(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: cs.onPrimaryContainer,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.user.fullName,
                    style: myMainTextStyle(context)
                        .copyWith(fontWeight: FontWeight.w500),
                  ),
                  Text(
                    widget.user.email,
                    style: myMainTextStyle(context)
                        .copyWith(fontSize: 11, color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Divider(color: cs.outlineVariant, height: 1),
        const SizedBox(height: 12),

        Text(
          isRoles ? 'Assign roles' : 'Assign to department',
          style: myMainTextStyle(context).copyWith(fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 10),

        // ── Scrollable list ───────────────────────────────
        Expanded(
          child: ListView(
            children: isRoles
                ? widget.roles.map((role) {
                    final isSelected = _selectedRoleIds.contains(role.id);
                    return ChipCard.fromRole(
                      role: role,
                      isSelected: isSelected,
                      onTap: () => setState(() => isSelected
                          ? _selectedRoleIds.remove(role.id)
                          : _selectedRoleIds.add(role.id)),
                    );
                  }).toList()
                : widget.departments.map((dept) {
                    final isSelected = _selectedDeptIds.contains(dept.id);
                    return ChipCard.fromDepartment(
                      department: dept,
                      isSelected: isSelected,
                      onTap: () => setState(() => isSelected
                          ? _selectedDeptIds.remove(dept.id)
                          : _selectedDeptIds.add(dept.id)),
                    );
                  }).toList(),
          ),
        ),

        // ── Footer ────────────────────────────────────────
        myDivider(context),
        MyOutlinedButton(
          onPressed: _save,
          btnText: 'Save',
          btnIcon: UniconsLine.save,
          btnAccent: Colors.greenAccent,
          isHovered: true,
        ),
      ],
    );
  }
}
