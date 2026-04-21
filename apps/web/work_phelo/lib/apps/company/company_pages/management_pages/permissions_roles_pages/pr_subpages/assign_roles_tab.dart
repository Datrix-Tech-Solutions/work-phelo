import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_permission_funtions/permissions_roles_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

import '../../../../../../work_phelo_components/theme/app_padding.dart';
import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import '../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../../../../work_phelo_components/widgets/misc/assign_panel.dart';

class AssignRolesTab extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
  const AssignRolesTab({super.key, required this.currentUser});

  @override
  ConsumerState<AssignRolesTab> createState() => AssignRolesTabState();
}

class AssignRolesTabState extends ConsumerState<AssignRolesTab> {
  EmployeeModel? _selectedEmployee;
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    // ← both scoped to this company
    final users = ref.watch(
      usersByTenantProvider(widget.currentUser.tenantSlug),
    );
    final roles = ref.watch(
      rolesByTenantProvider(widget.currentUser.tenantSlug),
    );

    final filtered = users
        .where(
          (u) =>
              u.fullName.toLowerCase().contains(_search.toLowerCase()) ||
              u.email.toLowerCase().contains(_search.toLowerCase()),
        )
        .toList();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MyCustomTextField(
                label: '',
                placeholder: 'Search employees...',
                onChange: (v) => setState(() => _search = v),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: DisplayCard(
                  child: ListView.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => myDivider(context),
                    itemBuilder: (context, index) {
                      final user = filtered[index];
                      return InkWell(
                        borderRadius: BorderRadius.circular(appRadius),
                        onTap: () => setState(() => _selectedEmployee = user),
                        child: Container(
                          decoration: _selectedEmployee?.email == user.email
                              ? BoxDecoration(
                                  color: cs.primaryContainer.withAlpha(60),
                                  borderRadius: BorderRadius.circular(12),
                                )
                              : null,
                          child: Padding(
                            padding: myContentPadding,
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundColor: cs.primaryContainer,
                                  child: Text(
                                    user.fullName
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
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        user.fullName,
                                        style: myMainTextStyle(
                                          context,
                                        ).copyWith(fontWeight: FontWeight.w500),
                                      ),
                                      Text(
                                        user.email,
                                        style: myMainTextStyle(context)
                                            .copyWith(
                                              fontSize: 11,
                                              color: cs.onSurfaceVariant,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                                // ── Role badges ─────────────────
                                Wrap(
                                  spacing: 4,
                                  children: user.systemRole.map((roleId) {
                                    final role = roles
                                        .where((r) => r.id == roleId)
                                        .firstOrNull;
                                    if (role == null) return const SizedBox();
                                    return Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: role.color.withAlpha(20),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        role.name,
                                        style: myMainTextStyle(context)
                                            .copyWith(
                                              fontSize: 11,
                                              color: role.color,
                                            ),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),

        SizedBox(
          width: 400,
          child: DisplayCard(
            child: _selectedEmployee == null
                ? Center(
                    child: Text(
                      'Select an employee to assign roles',
                      style: myMainTextStyle(
                        context,
                      ).copyWith(color: cs.onSurfaceVariant),
                      textAlign: TextAlign.center,
                    ),
                  )
                : AssignPanel(
                    key: ValueKey(_selectedEmployee!.email),
                    user: _selectedEmployee!,
                    roles: roles,
                    mode: AssignPanelMode.roles,
                    onChanged: () => setState(() {}),
                  ),
          ),
        ),
      ],
    );
  }
}
