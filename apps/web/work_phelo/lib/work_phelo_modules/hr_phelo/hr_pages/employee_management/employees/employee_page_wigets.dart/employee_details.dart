import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:work_phelo/work_phelo_modules/hr_phelo/hr_pages/employee_management/employees/employee_page_wigets.dart/employee_card.dart';
import 'package:work_phelo/work_phelo_modules/hr_phelo/hr_pages/employee_management/employees/employee_page_wigets.dart/employee_details_card.dart';
import 'package:work_phelo/work_phelo_components/widgets/custom_cards/display_card.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';

import '../../../../../../work_phelo_components/theme/app_padding.dart';
import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/widgets/custom_cards/title_card.dart';
import '../../../../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import 'employee_forms/off_boarding_form.dart';

class EmployeeDetailsPage extends ConsumerStatefulWidget {
  final EmployeeModel employee;
  final WidgetRef ref;
  final VoidCallback onBack;
  const EmployeeDetailsPage({
    super.key,
    required this.employee,
    required this.ref,
    required this.onBack,
  });

  @override
  ConsumerState<EmployeeDetailsPage> createState() => _EmployeeDetailsPageState();
}

class _EmployeeDetailsPageState extends ConsumerState<EmployeeDetailsPage> {
  late final _panel = SidePanelController();
  final _formKey = GlobalKey<OffBoardingFormState>();
  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);
    return DisplayCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: formPadding,
            child: InkWell(
              hoverColor: Colors.transparent,
              splashColor: Colors.transparent,
              highlightColor: Colors.transparent,
              onTap: widget.onBack,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: 'Employees',
                          style: myNoInfoStyle(context),
                        ),
                        TextSpan(text: ' > ', style: myNoInfoStyle(context)),
                        TextSpan(
                          text: widget.employee.fullName,
                          style: myNoInfoStyle(context).copyWith(
                            color: cs.onSurface,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          EmployeeWelcomeCard(
            employee: widget.employee,
            onOffboard: () => _panel.show(
              context: context,
              formTitle: 'Company Offboarding Form',
              onPressed: () {
                final success = _formKey.currentState?.submit() ?? false;
                if (success) _panel.close();
              },
              secOnPressed: () => _formKey.currentState?.reset(),
              child: OffBoardingForm(
                key: _formKey,
                // currentUser: widget.currentUser,
              ),
            ),
            onEdit: () {},
          ),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: EmployeeSummaryCard(user: widget.employee)),
                Expanded(
                  flex: 2,
                  child: SingleChildScrollView(
                    padding: menuCardpadding,
                    child: Column(
                      children: [
                        EmployeeDetailsCard(
                          cardTitle: 'Employement Details',
                          details: [
                            DetailItem(
                              label: "Department",
                              value: widget.employee.department ?? '-',
                            ),
                            DetailItem(
                              label: "Job Title",
                              value: widget.employee.jobTitle,
                            ),
                            DetailItem(
                              label: "Reporting Manager",
                              value: widget.employee.reportingManager ?? '-',
                            ),
                            DetailItem(
                              label: "Date of Hire",
                              value: DateFormat(
                                'EEE, dd MMMM, yyyy',
                              ).format(widget.employee.hiredDate),
                            ),
                            DetailItem(
                              label: 'Employment Type',
                              value: widget.employee.employmentType,
                            ),
                          ],
                        ),
                        EmployeeDetailsCard(
                          cardTitle: 'Account Details',
                          details: [
                            DetailItem(
                              label: "Annual Salary",
                              value: (widget.employee.annualSalary).toString(),
                            ),
                            DetailItem(
                              label: "Job Title",
                              value: widget.employee.jobTitle,
                            ),
                            DetailItem(
                              label: "Reporting Manager",
                              value: widget.employee.reportingManager ?? '-',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
