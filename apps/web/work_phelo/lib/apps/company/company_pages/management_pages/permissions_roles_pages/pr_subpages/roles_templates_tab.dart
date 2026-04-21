import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_permission_funtions/company_modules_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_permission_funtions/permissions_roles_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../../../work_phelo_components/theme/app_padding.dart';
import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../../../../work_phelo_components/widgets/custom_cards/app_chip_card.dart';
import '../../../../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import 'custom_role_form.dart';

class RoleTemplatesTab extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
  const RoleTemplatesTab({super.key, required this.currentUser});

  @override
  ConsumerState<RoleTemplatesTab> createState() => RoleTemplatesTabState();
}

class RoleTemplatesTabState extends ConsumerState<RoleTemplatesTab> {
  EmployeePermission? _selectedRole;
  bool _showCustomForm = false;

  @override
  Widget build(BuildContext context) {
    // ← scoped to this company
    final roles = ref.watch(rolesByTenantProvider(widget.currentUser.tenantSlug));

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 280,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TEMPLATES',
                style: myMainTextStyle(context).copyWith(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: ListView(
                  children: [
                    ...roles.map(
                      (role) => ChipCard.fromRole(
                        role: role,
                        isSelected: _selectedRole?.id == role.id,
                        onTap: () => setState(() {
                          _selectedRole = role;
                          _showCustomForm = false;
                        }),
                      ),
                    ),
                    const SizedBox(height: 6),
                    AddExtraCardChip(
                      chipLabel: 'Custom role',
                      isSelected: _showCustomForm,
                      onTap: () => setState(() {
                        _showCustomForm = true;
                        _selectedRole = null;
                      }),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(width: 16),

        Expanded(
          child: _showCustomForm
              ? CustomRoleForm(
                  currentUser: widget.currentUser,
                  onSaved: () => setState(() => _showCustomForm = false),
                )
              : _selectedRole != null
              ? _RoleDetail(role: _selectedRole!)
              : _EmptyDetail(),
        ),
      ],
    );
  }
}




class _RoleDetail extends StatelessWidget {
  final EmployeePermission role;

  const _RoleDetail({required this.role});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: ListTile(
                title: Text(role.name, style: myLargeTextStyle(context)),
                subtitle: Text(
                  role.description,
                  style: myMainTextStyle(
                    context,
                  ).copyWith(color: cs.onSurfaceVariant),
                ),
              ),
            ),
            if (role.isLocked)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: role.color.withAlpha(20),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Predefined — locked',
                  style: myMainTextStyle(
                    context,
                  ).copyWith(fontSize: 12, color: role.color),
                ),
              ),
          ],
        ),
        Expanded(
          child: DisplayCard(
            child: ListView.separated(
              itemCount: PermissionModule.values.length,
              separatorBuilder: (_, _) => myDivider(context),
              itemBuilder: (context, index) {
                final module = PermissionModule.values[index];
                final hasAccess = role.modules.contains(module);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              module.label,
                              style: myMainTextStyle(
                                context,
                              ).copyWith(fontWeight: FontWeight.w500),
                            ),
                            Text(
                              module.description,
                              style: myMainTextStyle(context).copyWith(
                                fontSize: 12,
                                color: cs.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Toggle — disabled for locked roles
                      IgnorePointer(
                        ignoring: role.isLocked,
                        child: Opacity(
                          opacity: role.isLocked ? 0.5 : 1.0,
                          child: Switch(
                            value: hasAccess,
                            onChanged: (_) {},
                            activeThumbColor: role.color,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        if (role.isLocked) ...[
          Padding(
            padding: myContentPadding,
            child: Text(
              'This is a predefined role and cannot be edited.',
              style: myMainTextStyle(
                context,
              ).copyWith(fontSize: 12, color: cs.onSurfaceVariant),
            ),
          ),
        ],
      ],
    );
  }
}

class _EmptyDetail extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Text(
          'Select a role to view its permissions',
          style: myMainTextStyle(context).copyWith(color: cs.onSurfaceVariant),
        ),
      ),
    );
  }
}
