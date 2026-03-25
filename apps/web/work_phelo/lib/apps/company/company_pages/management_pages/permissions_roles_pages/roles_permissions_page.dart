import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../components/app_theme/text_styles.dart';
import '../../management_widgets/mgt_tab.dart';
import 'pr_subpages/assign_roles_tab.dart';
import 'pr_subpages/roles_templates_tab.dart';

class RolesPermissionsPage extends ConsumerStatefulWidget {
  final AppUser currentUser;
  final VoidCallback onBack;
  const RolesPermissionsPage({super.key, required this.onBack,required this.currentUser});

  @override
  ConsumerState<RolesPermissionsPage> createState() =>
      _RolesPermissionsPageState();
}

class _RolesPermissionsPageState extends ConsumerState<RolesPermissionsPage> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────
          ListTile(
            title: Text(
              'Roles & permissions',
              style: myLargeTextStyle(context),
            ),
            subtitle: Text(
              'Define roles and assign them to employees',
              style: myMainTextStyle(
                context,
              ).copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
            trailing: IconButton(
              onPressed: widget.onBack,
              icon: Icon(UniconsLine.building),
            ),
          ),

          // ── Tabs ─────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                MgtTab(
                  label: 'Role templates',
                  isSelected: _tabIndex == 0,
                  onTap: () => setState(() => _tabIndex = 0),
                ),
                MgtTab(
                  label: 'Assign roles',
                  isSelected: _tabIndex == 1,
                  onTap: () => setState(() => _tabIndex = 1),
                ),
              ],
            ),
          ),

          // ── Content ──────────────────────────────────────
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children:  [RoleTemplatesTab(currentUser: widget.currentUser,), AssignRolesTab(currentUser: widget.currentUser,)],
            ),
          ),
        ],
      ),
    );
  }
}
