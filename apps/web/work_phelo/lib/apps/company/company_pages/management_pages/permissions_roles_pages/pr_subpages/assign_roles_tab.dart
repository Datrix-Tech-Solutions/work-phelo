import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../../Functions/company_functions/onboarding_function/onboarding_model.dart';
import '../../../../../../Functions/company_functions/onboarding_function/user_state.dart';
import '../../../../../../Functions/company_functions/permissions/roles_state.dart';
import '../../../../../../components/app_theme/misc.dart';
import '../../../../../../components/app_theme/padding.dart';
import '../../../../../../components/app_theme/text_styles.dart';
import '../../../../../../components/app_widgets/cards/display_card.dart';
import '../../../../../../components/form_components/assign_panel.dart';
import '../../../../../../components/form_components/text_fields.dart';

class AssignRolesTab extends ConsumerStatefulWidget {
  final AppUser currentUser;
  const AssignRolesTab({super.key, required this.currentUser});

  @override
  ConsumerState<AssignRolesTab> createState() => AssignRolesTabState();
}

class AssignRolesTabState extends ConsumerState<AssignRolesTab> {
  UserModel? _selectedEmployee;
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
