import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';

import '../../../../../../Functions/company_functions/onboarding_function/user_state.dart';
import '../../../../../../components/app_theme/text_styles.dart';
import '../../../../../../components/form_components/my_buttons.dart';
import '../../../../../../components/form_components/text_fields.dart';

class OffBoardingForm extends ConsumerStatefulWidget {
  const OffBoardingForm({super.key});

  @override
  ConsumerState<OffBoardingForm> createState() => _OffBoardingFormState();
}

class _OffBoardingFormState extends ConsumerState<OffBoardingForm> {
  final _formKey = GlobalKey<FormState>();
  final _notesController = TextEditingController();

  bool _assetCheck = false;
  bool _hrCheck = false;
  bool _financeCheck = false;
  bool _managerCheck = false;

  String? _selectedEmployee;
  String? _selectedReason;
  DateTime? _lastWorkingDay;
  final _otherReasonController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
    _otherReasonController.dispose();

    super.dispose();
  }

  void _reset() {
    _formKey.currentState?.reset();
    _notesController.clear();
    setState(() {
      _selectedEmployee = null;
      _selectedReason = null;
      _lastWorkingDay = null;
      _assetCheck = false;
      _hrCheck = false;
      _financeCheck = false;
      _managerCheck = false;
    });
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_selectedEmployee == null ||
        _selectedReason == null ||
        _lastWorkingDay == null) {
      return;
    }

    final employees = ref.read(activeUsersProvider);
    final user = employees.firstWhereOrNull(
      (u) => u.fullName == _selectedEmployee,
    );

    if (user == null) return;

    ref.read(userProvider.notifier).deactivateUser(user.email);
    _reset();
  }

  @override
  Widget build(BuildContext context) {
    const double csize = 0.35;
    final employees = ref.watch(activeUsersProvider);
    final employeeNames = employees.map((u) => u.fullName).toList();

    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Employee selection ──────────────────────────────
            Wrap(
              children: [
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize * 2,
                  child: MyDropdownField(
                    placeholder: employees.isEmpty
                        ? 'No active employees'
                        : 'Select Employee',
                    items: employeeNames,
                    label: 'Employee',
                    initialValue: _selectedEmployee,
                    onChanged: (val) => setState(() => _selectedEmployee = val),
                  ),
                ),
              ],
            ),

            // ── Reason + last day ───────────────────────────────
            Wrap(
              children: [
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize,
                  child: MyDropdownField(
                    label: 'Offboarding Reason',
                    placeholder: 'Select a reason',
                    items: [
                      'Resignation',
                      'Termination',
                      'Contract End',
                      'Redundancy',
                      'Retirement',
                      'Other',
                    ],
                    initialValue: _selectedReason,
                    onChanged: (val) => setState(() => _selectedReason = val),
                  ),
                ),
                if (_selectedReason == 'Other')
                  SizedBox(
                    width: MediaQuery.sizeOf(context).width * csize,
                    child: MyCustomTextField(
                      label: 'Other reason',
                      placeholder: 'Type other reason',
                      controller: _otherReasonController,
                      validator: (v) =>
                          v?.trim().isEmpty ?? true ? 'Required' : null,
                    ),
                  ),
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize,
                  child: MyDatePicker(
                    placeholder: 'dd/mm/yyyy',
                    label: 'Last Working Day',
                    firstDate: DateTime.now(),
                    onDateSelected: (date) =>
                        setState(() => _lastWorkingDay = date),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),
            _buildSectionHeader(context, 'Clearance Checklist'),
            const SizedBox(height: 16),

            // ── Checklist ───────────────────────────────────────
            Wrap(
              children: [
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize * 2,
                  child: MyCheckBox(
                    label: 'Asset Return',
                    value: _assetCheck,
                    onChanged: (val) => setState(() => _assetCheck = val),
                  ),
                ),
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize * 2,
                  child: MyCheckBox(
                    label: 'HR Clearance',
                    value: _hrCheck,
                    onChanged: (val) => setState(() => _hrCheck = val),
                  ),
                ),
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize * 2,
                  child: MyCheckBox(
                    label: 'Finance Clearance',
                    value: _financeCheck,
                    onChanged: (val) => setState(() => _financeCheck = val),
                  ),
                ),
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize * 2,
                  child: MyCheckBox(
                    label: 'Manager Approval',
                    value: _managerCheck,
                    onChanged: (val) => setState(() => _managerCheck = val),
                  ),
                ),
              ],
            ),

            // ── Exit notes ──────────────────────────────────────
            Wrap(
              children: [
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize * 2,
                  child: MyCustomTextField(
                    label: 'Exit Interview Notes',
                    placeholder: 'Document exit interview details',
                    controller: _notesController,
                    maxLines: 7,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 48),

            // ── Actions ─────────────────────────────────────────
            Wrap(
              children: [
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize * .5,
                  child: MyOutlinedButton(
                    onPressed: _reset,
                    btnText: 'reset',
                    btnIcon: UniconsLine.times_circle,
                    btnAccent: ColorScheme.of(context).error,
                    isHovered: false,
                  ),
                ),
                SizedBox(
                  width: MediaQuery.sizeOf(context).width * csize,
                  child: MyButton(
                    btnText: 'Process Offboarding',
                    btnOnPressed: _submit,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
    return Text(
      title.toUpperCase(),
      style: myMainTextStyle(context).copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.1,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }
}
