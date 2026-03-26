import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_appraisal_functions/employee_appraisal_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_appraisal_functions/employee_appraisal_state.dart';

class EmployeeAppraisalForm extends ConsumerStatefulWidget {
  final AppraisalRecord record;
  final String currentUserEmail;

  const EmployeeAppraisalForm({
    super.key,
    required this.record,
    required this.currentUserEmail,
  });

  @override
  ConsumerState<EmployeeAppraisalForm> createState() => _EmployeeAppraisalFormState();
}

class _EmployeeAppraisalFormState extends ConsumerState<EmployeeAppraisalForm> {
  final Map<String, int> _ratings = {};
  final Map<String, String> _comments = {};

  void _submit() {
    if (_ratings.length != widget.record.templateId /* wait, better get questions from template */) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please rate all questions')),
      );
      return;
    }

    ref.read(appraisalProvider.notifier).submitEmployeeResponse(
          recordId: widget.record.id,
          employeeEmail: widget.currentUserEmail,
          ratings: _ratings,
          comments: _comments,
        );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Self-appraisal submitted')),
    );
  }

  @override
  Widget build(BuildContext context) {
    

    return Column(
      children: [
        // Render questions from template here with Rating (1-10) + Comment field
        // Use StarRating or Slider or Number buttons

        ElevatedButton(
          onPressed: _submit,
          child: const Text('Submit Self Assessment'),
        ),
      ],
    );
  }
}