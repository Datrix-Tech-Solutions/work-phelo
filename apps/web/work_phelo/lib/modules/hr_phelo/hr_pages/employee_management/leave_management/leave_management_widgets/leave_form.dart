import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../../Functions/company_functions/leave_function/leave__request_model.dart';
import '../../../../../../Functions/company_functions/leave_function/leave_state.dart';
import '../../../../../../components/form_components/text_fields.dart';

class LeaveForm extends ConsumerStatefulWidget {
  final AppUser currentUser;
  const LeaveForm({super.key, required this.currentUser});

  @override
  ConsumerState<LeaveForm> createState() => LeaveFormState();
}

class LeaveFormState extends ConsumerState<LeaveForm> {
  final _formKey = GlobalKey<FormState>();

  String? selectedLeaveType;
  DateTime? startDate;
  DateTime? endDate;
  final reasonController = TextEditingController();

  @override
  void dispose() {
    reasonController.dispose();
    super.dispose();
  }

  LeaveType mapStringToLeaveType(String value) {
    switch (value.toLowerCase()) {
      case 'annual':
        return LeaveType.annual;
      case 'sick':
        return LeaveType.sick;
      case 'maternity':
        return LeaveType.maternity;
      case 'paternity':
        return LeaveType.paternity;
      case 'study':
        return LeaveType.study;
      case 'unpaid':
        return LeaveType.unpaid;
      default:
        return LeaveType.annual;
    }
  }

  void submit() {
    if (!_formKey.currentState!.validate()) return;

    if (selectedLeaveType == null || startDate == null || endDate == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Please fill all fields")));
      return;
    }

    if (endDate!.isBefore(startDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("End date cannot be before start date")),
      );
      return;
    }

    final request = LeaveRequestModel(
      id: UniqueKey().toString(),
      employeeEmail: widget.currentUser.email,
      tenantSlug: widget.currentUser.tenantSlug,
      type: LeaveTypeX.fromString(selectedLeaveType!),
      startDate: startDate!,
      endDate: endDate!,
      reason: reasonController.text.trim(),
      createdAt: DateTime.now(),
    );

    try {
      ref.read(leaveProvider.notifier).applyLeave(request);

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Leave request submitted")));

      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  void reset() {
    _formKey.currentState?.reset();
    reasonController.clear();
    setState(() {
      selectedLeaveType = null;
      startDate = null;
      endDate = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          children: [
            MyDropdownField(
              placeholder: 'Select leave type',
              label: 'Leave Type',
              items: const [
                'Annual',
                'Sick',
                'Maternity',
                'Paternity',
                'Unpaid',
                'Study',
              ],
              onChanged: (value) {
                setState(() {
                  selectedLeaveType = value;
                });
              },
              validator: (value) => value == null ? 'Select leave type' : null,
            ),

            MyDatePicker(
              placeholder: 'dd/mm/yyyy',
              label: 'Start date',
              firstDate: DateTime.now(),
              onDateSelected: (date) {
                setState(() {
                  startDate = date;
                });
              },
            ),

            MyDatePicker(
              placeholder: 'dd/mm/yyyy',
              label: 'End date',
              firstDate: startDate ?? DateTime.now(),
              onDateSelected: (date) {
                setState(() {
                  endDate = date;
                });
              },
            ),

            MyCustomTextField(
              controller: reasonController,
              label: 'Reason',
              placeholder: 'give reason for the leave',
              validator: (value) =>
                  value == null || value.isEmpty ? 'Reason is required' : null,
            ),
          ],
        ),
      ),
    );
  }
}
