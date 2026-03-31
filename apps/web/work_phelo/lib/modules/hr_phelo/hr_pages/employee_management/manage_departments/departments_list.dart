import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../work_phelo_components/widgets/custom_cards/app_chip_card.dart';
import 'manage_dept_subpages/dept_helpers.dart';
import 'manage_dept_subpages/dept_list_details.dart';

class DepartmentsList extends ConsumerStatefulWidget {
  final AppUserModel currentUser;

  const DepartmentsList({super.key, required this.currentUser});

  @override
  ConsumerState<DepartmentsList> createState() => _DepartmentsListState();
}

class _DepartmentsListState extends ConsumerState<DepartmentsList> {
  bool _showCreateForm = false;
  CompanyDepartmentsModel? _selectedDepartment;

  @override
  Widget build(BuildContext context) {
    final departments = ref.watch(
      departmentsByTenantProvider(widget.currentUser.tenantSlug),
    );

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
          child: _selectedDepartment != null
              ? DeptDetail(
                  key: ValueKey(_selectedDepartment!.id),
                  departmentId: _selectedDepartment!.id,
                  currentUser: widget.currentUser,
                  onDeleted: () => setState(() => _selectedDepartment = null),
                )
              : const EmptyDetail(),
        ),
      ],
    );
  }
}
