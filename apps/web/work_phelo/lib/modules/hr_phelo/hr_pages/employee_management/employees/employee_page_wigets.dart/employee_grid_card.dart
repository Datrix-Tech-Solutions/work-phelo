import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../../../Modules/hr_phelo/hr_pages/employee_management/employees/employee_page_wigets.dart/onboarding_form.dart';
import '../../../../../../work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_model.dart';
import '../../../../../../work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import '../../../../../../work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../../../work_phelo_components/theme/app.colors.dart';
import '../../../../../../work_phelo_components/theme/app_padding.dart';
import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import 'employee_card.dart';
import '../../../../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';

class EmployeeGridCard extends StatefulWidget {
  final List<EmployeeModel> users;
  final List<CompanyDepartmentsModel> departments;
  final AppUserModel currentUser;
  final String search;
  final String? departmentFilter;
  final void Function(String) onSearchChanged;
  final void Function(String?) onDepartmentChanged;
  final void Function(EmployeeModel)? onCardTap;
  final VoidCallback newEmployee;

  const EmployeeGridCard({
    super.key,
    required this.users,
    required this.departments,
    required this.currentUser,
    required this.search,
    required this.departmentFilter,
    required this.onSearchChanged,
    required this.onDepartmentChanged,
    this.onCardTap,
    required this.newEmployee,
  });

  @override
  State<EmployeeGridCard> createState() => _EmployeeGridCardState();
}

class _EmployeeGridCardState extends State<EmployeeGridCard> {
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossCount = constraints.maxWidth >= 1200
            ? 5
            : constraints.maxWidth >= 900
            ? 4
            : constraints.maxWidth >= 600
            ? 3
            : 2;

        return DisplayCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              sectionHeader(context, 'Employees'),
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: CustomSearchField(
                      hinttext: 'Search employee...',
                      onChanged: widget.onSearchChanged,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: MyDropdownField(
                      placeholder: 'Filter by department',
                      items: [
                        'All departments',
                        ...widget.departments.map((d) => d.name),
                      ],
                      onChanged: widget.onDepartmentChanged,
                    ),
                  ),
                  const Spacer(),
                  MyOutlinedMenuButton(
                    onPressed: () {},
                    btnText: 'Export',
                    btnIcon: UniconsLine.export,
                    btnAccent: myMainColor,
                    isHovered: false,
                  ),
                  const SizedBox(width: 8),
                  MyOutlinedMenuButton(
                    onPressed: widget.newEmployee,
                    btnText: 'New employee',
                    btnIcon: UniconsLine.user_plus,
                    btnAccent: myMainColor,
                    isHovered: false,
                  ),
                ],
              ),

              // ── Empty state ──────────────────────────────
              if (widget.users.isEmpty)
                Expanded(
                  child: Center(
                    child: Text(
                      widget.search.isNotEmpty ||
                              widget.departmentFilter != null
                          ? 'No employees match your search'
                          : 'No employees yet',
                      style: myMainTextStyle(context).copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                )
              else
                Expanded(
                  child: Padding(
                    padding: myContentPadding,
                    child: GridView.builder(
                      padding: const EdgeInsets.only(top: 8),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: crossCount,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                        mainAxisExtent: 350,
                      ),
                      itemCount: widget.users.length,
                      itemBuilder: (context, index) => EmployeeCard(
                        user: widget.users[index],
                        onTap: widget.onCardTap != null
                            ? () => widget.onCardTap!(widget.users[index])
                            : null,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
