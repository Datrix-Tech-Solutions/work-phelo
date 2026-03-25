import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../Components/App_Theme/text_styles.dart';
import '../../../../../Components/app_theme/padding.dart';
import '../../../../../Functions/company_functions/departments/department_model.dart';
import '../../../../../Functions/company_functions/departments/department_state.dart';
import '../../../../../components/app_theme/misc.dart';
import '../../../../../components/app_widgets/lists/chip_card.dart';
import 'manage_dept_subpages/create_department_form.dart';
import 'manage_dept_subpages/dept_helpers.dart';
import 'manage_dept_subpages/dept_list_details.dart';

class DepartmentsList extends ConsumerStatefulWidget {
  final AppUser currentUser;

  const DepartmentsList({super.key, required this.currentUser});

  @override
  ConsumerState<DepartmentsList> createState() => _DepartmentsListState();
}

class _DepartmentsListState extends ConsumerState<DepartmentsList> {
  bool _showCreateForm = false;
  DepartmentModel? _selectedDepartment;

  @override
  Widget build(BuildContext context) {
    final departments = ref.watch(
      departmentsByTenantProvider(widget.currentUser.tenantSlug),
    );
    final cs = Theme.of(context).colorScheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Left: department list ─────────────────────────
        SizedBox(
          width: 260,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  'DEPARTMENTS',
                  style: myMainTextStyle(context).copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              Expanded(
                child: ListView(
                  children: [
                    AddExtraCardChip(
                      chipLabel: 'Create a department',
                      isSelected: _showCreateForm,
                      onTap: () => setState(() {
                        _showCreateForm = true;
                        _selectedDepartment = null;
                      }),
                    ),
                    const SizedBox(height: 6),
                    ...departments.map((dept) {
                      final isSelected =
                          _selectedDepartment?.id == dept.id &&
                          !_showCreateForm;
                      return ChipCard.fromDepartment(
                        department: dept,
                        isSelected: isSelected,
                        onTap: () => setState(() {
                          _selectedDepartment = dept;
                          _showCreateForm = false;
                        }),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(width: 16),

        // ── Right: detail / form panel ────────────────────
        Expanded(
          child: _showCreateForm
              ? Navigator(
                  onGenerateRoute: (_) => MaterialPageRoute(
                    builder: (_) => CreateDepartmentForm(
                      currentUser: widget.currentUser,
                      onSaved: () => setState(() => _showCreateForm = false),
                    ),
                  ),
                )
              : _selectedDepartment != null
              ? Container(
                  padding: myContentPadding,
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(appRadius),
                  ),
                  child: DeptDetail(
                    key: ValueKey(_selectedDepartment!.id),
                    departmentId: _selectedDepartment!.id,
                    currentUser: widget.currentUser,
                    onDeleted: () => setState(() => _selectedDepartment = null),
                  ),
                )
              : const EmptyDetail(),
        ),
      ],
    );
  }
}
