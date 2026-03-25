import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../../Components/App_Theme/text_styles.dart';
import '../../../../../../Functions/company_functions/departments/department_model.dart';
import '../../../../../../Functions/company_functions/departments/department_state.dart';
import '../../../../../../Functions/company_functions/onboarding_function/user_state.dart';
import '../../../../../../components/app_theme/misc.dart';
import '../../../../../../components/form_components/my_side_panel.dart';
import 'dept_forms.dart';
import 'dept_helpers.dart';
import 'edit_department_form.dart';

class DeptDetail extends ConsumerStatefulWidget {
  final String departmentId;
  final AppUser currentUser;
  final VoidCallback onDeleted;

  const DeptDetail({
    super.key,
    required this.departmentId,
    required this.currentUser,
    required this.onDeleted,
  });

  @override
  ConsumerState<DeptDetail> createState() => DeptDetailState();
}

class DeptDetailState extends ConsumerState<DeptDetail> {
  late TextEditingController _nameController;
  late final _panel = SidePanelController();
  final _formKey = GlobalKey<DepartmentMemberSideBarState>();
  final _editKey = GlobalKey<EditFormState>();

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _delete(DepartmentModel dept) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete department'),
        content: Text('Are you sure you want to delete "${dept.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: ColorScheme.of(context).errorContainer,
              foregroundColor: ColorScheme.of(context).error,
            ),
            onPressed: () {
              Navigator.pop(context);
              ref.read(departmentProvider.notifier).deleteDepartment(dept.id);
              widget.onDeleted();
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final dept = ref.watch(departmentByIdProvider(widget.departmentId));

    if (dept == null) return const EmptyDetail();

    final members = ref.watch(departmentMembersProvider(widget.departmentId));
    final head = ref.watch(departmentHeadProvider(widget.departmentId));
    final tenantUsers = ref.watch(
      usersByTenantProvider(widget.currentUser.tenantSlug),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Header ────────────────────────────────────────
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: dept.color.withAlpha(20),
                borderRadius: BorderRadius.circular(appRadius),
              ),
              child: Icon(dept.icon, color: dept.color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(dept.name, style: myMainTextStyle(context)),
                  Text(
                    '${dept.memberCount} member${dept.memberCount == 1 ? '' : 's'}',
                    style: myNoInfoStyle(
                      context,
                    ).copyWith(color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),

            // ── Action buttons ──────────────────────────
            IconButton(
              tooltip: 'Edit',
              icon: Icon(UniconsLine.edit, color: cs.onSurfaceVariant),
              onPressed: () {
                final editWidget = EditForm(
                  key: _editKey,
                  dept: dept,
                  currentUser: widget.currentUser,
                );
                _panel.show(
                  context: context,
                  formTitle: 'Edit — ${dept.name}',
                  onPressed: () {
                    _editKey.currentState?.submit();
                    _panel.close();
                  },
                  secOnPressed: () => _editKey.currentState?.reset(),
                  child: editWidget,
                );
              },
            ),
            IconButton(
              tooltip: 'Delete',
              icon: Icon(UniconsLine.trash, color: cs.error),
              onPressed: () => _delete(dept),
            ),
          ],
        ),
        Expanded(
          child: ListView(
            children: [
              // ── Head ─────────────────────────────────
              const SizedBox(height: 8),
              if (head != null) ...[
                SectionLabel(label: 'Department head'),
                MemberTile(
                  user: head,
                  trailing: TextButton(
                    onPressed: () => ref
                        .read(departmentProvider.notifier)
                        .clearHead(dept.id),
                    child: const Text('Remove'),
                  ),
                ),
              ] else ...[
                SectionLabel(label: 'This Department has no head'),
              ],
          
              // ── Members ───────────────────────────────
              Row(
                children: [
                  const Expanded(child: SectionLabel(label: 'Members')),
                  TextButton.icon(
                    onPressed: () {
                      final sidebarWidget = DepartmentMemberSideBar(
                        key: _formKey,
                        dept: dept,
                        currentUser: widget.currentUser,
                        tenantUsers: tenantUsers,
                        currentMembers: members,
                      );
          
                      _panel.show(
                        context: context,
                        formTitle: 'Add members — ${dept.name}',
                        onPressed: () {
                          _formKey.currentState?.submit();
                          _panel.close();
                        },
                        secOnPressed: () => _formKey.currentState?.reset(),
                        child: sidebarWidget,
                      );
                    },
                    icon: const Icon(UniconsLine.user_plus, size: 16),
                    label: const Text('Add members'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (members.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text(
                      'No members yet',
                      style: myMainTextStyle(
                        context,
                      ).copyWith(color: cs.onSurfaceVariant),
                    ),
                  ),
                )
              else
                ...members.map(
                  (u) => MemberTile(
                    user: u,
                    trailing: IconButton(
                      icon: Icon(
                        UniconsLine.times_circle,
                        size: 18,
                        color: cs.error,
                      ),
                      tooltip: 'Remove',
                      onPressed: () => ref
                          .read(departmentProvider.notifier)
                          .removeMember(dept.id, u.email),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
