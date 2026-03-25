import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../Modules/hr_phelo/hr_pages/employee_management/employees/employee_page_wigets.dart/onboarding_form.dart';
import '../../../Components/App_Theme/text_styles.dart';
import '../../../Components/app_theme/colors.dart';
import '../../../Functions/company_functions/departments/department_model.dart';
import '../../../Functions/company_functions/onboarding_function/onboarding_model.dart';
import '../../app_theme/padding.dart';
import '../../form_components/my_buttons.dart';
import '../../form_components/text_fields.dart';
import '../cards/display_card.dart';
import '../cards/employee_card.dart';

class EmployeeCardGrid extends StatefulWidget {
  final List<UserModel> users;
  final List<DepartmentModel> departments;
  final AppUser currentUser;
  final String search;
  final String? departmentFilter;
  final void Function(String) onSearchChanged;
  final void Function(String?) onDepartmentChanged;
  final void Function(UserModel)? onCardTap;
  final VoidCallback newEmployee;

  const EmployeeCardGrid({
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
  State<EmployeeCardGrid> createState() => _EmployeeCardGridState();
}

class _EmployeeCardGridState extends State<EmployeeCardGrid> {
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
