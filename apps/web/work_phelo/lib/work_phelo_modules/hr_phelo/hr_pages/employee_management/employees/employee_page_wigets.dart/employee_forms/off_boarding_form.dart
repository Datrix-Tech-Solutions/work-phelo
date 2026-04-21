import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';

import '../../../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';

class OffBoardingForm extends ConsumerStatefulWidget {
  const OffBoardingForm({super.key});

  @override
  ConsumerState<OffBoardingForm> createState() => OffBoardingFormState();
}

class OffBoardingFormState extends ConsumerState<OffBoardingForm> {
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

  void reset() {
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

  bool submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return false;
    if (_selectedEmployee == null ||
        _selectedReason == null ||
        _lastWorkingDay == null) {
      return false;
    }

    final employees = ref.read(activeUsersProvider);
    final user = employees.firstWhereOrNull(
      (u) => u.fullName == _selectedEmployee,
    );

    if (user == null) return false;

    ref.read(userProvider.notifier).deactivateUser(user.email);
    reset();
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Employee selection ──────────────────────────────
            // MyDropdownField(
            //   placeholder: employees.isEmpty
            //       ? 'No active employees'
            //       : 'Select Employee',
            //   items: employeeNames,
            //   label: 'Employee',
            //   initialValue: _selectedEmployee,
            //   onChanged: (val) => setState(() => _selectedEmployee = val),
            // ),

            // ── Reason + last day ───────────────────────────────
            MyDropdownField(
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
            if (_selectedReason == 'Other')
              MyCustomTextField(
                label: 'Other reason',
                placeholder: 'Type other reason',
                controller: _otherReasonController,
                validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
              ),
            MyDatePicker(
              placeholder: 'dd/mm/yyyy',
              label: 'Last Working Day',
              firstDate: DateTime.now(),
              onDateSelected: (date) => setState(() => _lastWorkingDay = date),
            ),

            const SizedBox(height: 16),
            sectionHeader(context, 'Clearance Checklist'),
            const SizedBox(height: 16),

            // ── Checklist ───────────────────────────────────────
            MyCheckBox(
              label: 'Asset Return',
              value: _assetCheck,
              onChanged: (val) => setState(() => _assetCheck = val),
            ),
            MyCheckBox(
              label: 'HR Clearance',
              value: _hrCheck,
              onChanged: (val) => setState(() => _hrCheck = val),
            ),
            MyCheckBox(
              label: 'Finance Clearance',
              value: _financeCheck,
              onChanged: (val) => setState(() => _financeCheck = val),
            ),
            MyCheckBox(
              label: 'Manager Approval',
              value: _managerCheck,
              onChanged: (val) => setState(() => _managerCheck = val),
            ),

            // ── Exit notes ──────────────────────────────────────
            MyCustomTextField(
              label: 'Exit Interview Notes',
              placeholder: 'Document exit interview details',
              controller: _notesController,
              maxLines: 7,
            ),
          ],
        ),
      ),
    );
  }
}
