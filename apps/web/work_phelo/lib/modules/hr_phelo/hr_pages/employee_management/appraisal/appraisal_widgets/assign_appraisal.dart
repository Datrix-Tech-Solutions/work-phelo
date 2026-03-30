import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_appraisal_functions/employee_appraisal_state.dart';

import '../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';

class AssignAppraisalForm extends ConsumerStatefulWidget {
  final String tenantSlug;
  final VoidCallback? onSuccess;

  const AssignAppraisalForm({
    super.key,
    required this.tenantSlug,
    this.onSuccess,
  });

  @override
  ConsumerState<AssignAppraisalForm> createState() =>
      _AssignAppraisalFormState();
}

class _AssignAppraisalFormState extends ConsumerState<AssignAppraisalForm> {
  final _formKey = GlobalKey<FormState>();

  String? _selectedTemplateId;
  String? _employeeEmail;
  String? _managerEmail;
  String? _cycle;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    try {
      ref
          .read(appraisalProvider.notifier)
          .assignAppraisal(
            templateId: _selectedTemplateId!,
            employeeEmail: _employeeEmail!.trim(),
            managerEmail: _managerEmail!.trim(),
            tenantSlug: widget.tenantSlug,
            cycle: _cycle!.trim(),
          );

      widget.onSuccess?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Appraisal assigned successfully')),
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final templates = ref.watch(
      appraisalTemplatesByTenantProvider(widget.tenantSlug),
    );

    return Form(
      key: _formKey,
      child: Column(
        children: [
          MyDropdownField(
            label: 'Select Template',
            placeholder: 'Choose appraisal template',
            items: templates.map((t) => t.name).toList(),
            value: _selectedTemplateId != null
                ? templates.firstWhere((t) => t.id == _selectedTemplateId).name
                : null,
            onChanged: (name) {
              final template = templates.firstWhere((t) => t.name == name);
              setState(() => _selectedTemplateId = template.id);
            },
          ),
          MyCustomTextField(
            label: 'Employee Email',
            placeholder: 'employee@company.com',
            onChange: (val) => setState(() => _employeeEmail = val),
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          ),
          MyCustomTextField(
            label: 'Manager Email',
            placeholder: 'manager@company.com',
            onChange: (val) => setState(() => _managerEmail = val),
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          ),
          MyCustomTextField(
            label: 'Cycle',
            placeholder: '2026-Q1 or Annual-2026',
            onChange: (val) => setState(() => _cycle = val),
            validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submit,
              child: const Text('Assign Appraisal'),
            ),
          ),
        ],
      ),
    );
  }
}
