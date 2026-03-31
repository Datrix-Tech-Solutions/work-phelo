import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/theme/miscellaneouse.dart';

class EditForm extends ConsumerStatefulWidget {
  final CompanyDepartmentsModel dept;
  final AppUserModel currentUser;

  const EditForm({super.key, required this.dept, required this.currentUser});

  @override
  ConsumerState<EditForm> createState() => EditFormState();
}

class EditFormState extends ConsumerState<EditForm> {
  late TextEditingController _nameController;
  late TextEditingController _headSearchController;
  late Color _selectedColor;
  late IconData _selectedIcon;
  String _headSearch = '';
  String? _pendingHeadEmail;
  bool _clearHead = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.dept.name);
    _headSearchController = TextEditingController();
    _selectedColor = widget.dept.color;
    _selectedIcon = widget.dept.icon;
    _pendingHeadEmail = widget.dept.headEmail;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _headSearchController.dispose();
    super.dispose();
  }

  void submit() {
    final newName = _nameController.text.trim();
    if (newName.isEmpty) return;

    // Update name, color, icon
    ref
        .read(departmentProvider.notifier)
        .updateDepartment(
          widget.dept.copyWith(
            name: newName,
            color: _selectedColor,
            icon: _selectedIcon,
          ),
        );

    // Handle head changes separately
    if (_clearHead) {
      ref.read(departmentProvider.notifier).clearHead(widget.dept.id);
    } else if (_pendingHeadEmail != null &&
        _pendingHeadEmail != widget.dept.headEmail) {
      ref
          .read(departmentProvider.notifier)
          .setHead(widget.dept.id, _pendingHeadEmail!);
    }
  }

  void reset() {
    setState(() {
      _nameController.text = widget.dept.name;
      _selectedColor = widget.dept.color;
      _selectedIcon = widget.dept.icon;
      _headSearchController.clear();
      _headSearch = '';
      _pendingHeadEmail = widget.dept.headEmail;
      _clearHead = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final members = ref.watch(departmentMembersProvider(widget.dept.id));

    final tenantUsers = ref.watch(
      usersByTenantProvider(widget.currentUser.tenantSlug),
    );
    final displayHead = _clearHead
        ? null
        : tenantUsers.where((u) => u.email == _pendingHeadEmail).firstOrNull;

    final filtered = _headSearch.isEmpty
        ? members
        : members
              .where(
                (u) =>
                    u.fullName.toLowerCase().contains(
                      _headSearch.toLowerCase(),
                    ) ||
                    u.email.toLowerCase().contains(_headSearch.toLowerCase()),
              )
              .toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Name ─────────────────────────────────────────
        TextField(
          controller: _nameController,
          decoration: const InputDecoration(
            labelText: 'Department name',
            border: OutlineInputBorder(),
            isDense: true,
          ),
        ),

        const SizedBox(height: 20),

        // ── Color picker ──────────────────────────────────
        Text('Color', style: myMainTextStyle(context)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: departmentColors.map((c) {
            final isSelected = c == _selectedColor;
            return GestureDetector(
              onTap: () => setState(() => _selectedColor = c),
              child: Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: c,
                  shape: BoxShape.circle,
                  border: isSelected
                      ? Border.all(color: cs.onSurface, width: 2.5)
                      : null,
                ),
              ),
            );
          }).toList(),
        ),

        const SizedBox(height: 20),

        // ── Icon picker ───────────────────────────────────
        Text('Icon', style: myMainTextStyle(context)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: departmentIcons.map((icon) {
            final isSelected = icon == _selectedIcon;
            return GestureDetector(
              onTap: () => setState(() => _selectedIcon = icon),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: isSelected
                      ? _selectedColor.withAlpha(30)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(appRadius),
                  border: Border.all(
                    color: isSelected ? _selectedColor : cs.outlineVariant,
                    width: 0.5,
                  ),
                ),
                child: Icon(icon, size: 18, color: _selectedColor),
              ),
            );
          }).toList(),
        ),

        const SizedBox(height: 24),

        // ── Department head ───────────────────────────────
        Text('Department head', style: myMainTextStyle(context)),
        const SizedBox(height: 8),

        // Current head display
        if (displayHead != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _selectedColor.withAlpha(15),
              borderRadius: BorderRadius.circular(appRadius),
              border: Border.all(color: _selectedColor.withAlpha(60)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: cs.primaryContainer,
                  child: Text(
                    '${displayHead.firstName[0]}${displayHead.lastName[0]}',
                    style: TextStyle(
                      fontSize: 11,
                      color: cs.onPrimaryContainer,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    displayHead.fullName,
                    style: myMainTextStyle(
                      context,
                    ).copyWith(fontWeight: FontWeight.w500),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _clearHead = true;
                    _pendingHeadEmail = null;
                  }),
                  child: const Text('Remove'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Search field
        TextField(
          controller: _headSearchController,
          onChanged: (v) => setState(() => _headSearch = v),
          decoration: InputDecoration(
            hintText: members.isEmpty
                ? 'Add members first'
                : 'Search members...',
            prefixIcon: const Icon(Icons.search, size: 18),
            border: const OutlineInputBorder(),
            isDense: true,
            enabled: members.isNotEmpty,
          ),
        ),

        const SizedBox(height: 8),

        if (members.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'No members to assign as head yet.',
              style: myMainTextStyle(
                context,
              ).copyWith(color: cs.onSurfaceVariant),
            ),
          )
        else if (filtered.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'No results for "$_headSearch"',
              style: myMainTextStyle(
                context,
              ).copyWith(color: cs.onSurfaceVariant),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: cs.outlineVariant, width: 0.5),
              borderRadius: BorderRadius.circular(appRadius),
            ),
            child: Column(
              children: filtered.map((u) {
                final isSelected = _pendingHeadEmail == u.email;
                return ListTile(
                  onTap: () => setState(() {
                    _pendingHeadEmail = u.email;
                    _clearHead = false;
                    _headSearch = '';
                    _headSearchController.clear();
                  }),
                  leading: CircleAvatar(
                    radius: 14,
                    backgroundColor: cs.primaryContainer,
                    child: Text(
                      '${u.firstName[0]}${u.lastName[0]}',
                      style: TextStyle(
                        fontSize: 11,
                        color: cs.onPrimaryContainer,
                      ),
                    ),
                  ),
                  title: Text(u.fullName, style: myMainTextStyle(context)),
                  subtitle: Text(
                    u.jobTitle,
                    style: myMainTextStyle(
                      context,
                    ).copyWith(fontSize: 11, color: cs.onSurfaceVariant),
                  ),
                  trailing: isSelected
                      ? Icon(
                          Icons.check_circle,
                          color: _selectedColor,
                          size: 18,
                        )
                      : null,
                  dense: true,
                );
              }).toList(),
            ),
          ),
      ],
    );
  }
}
