import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_appraisal_functions/employee_appraisal_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_appraisal_functions/employee_appraisal_state.dart';

import '../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';

class CreateAppraisalTemplateForm extends ConsumerStatefulWidget {
  final String tenantSlug;
  final String createdBy;
  final VoidCallback? onSuccess;

  const CreateAppraisalTemplateForm({
    super.key,
    required this.tenantSlug,
    required this.createdBy,
    this.onSuccess,
  });

  @override
  ConsumerState<CreateAppraisalTemplateForm> createState() =>
      _CreateAppraisalTemplateFormState();
}

class _CreateAppraisalTemplateFormState
    extends ConsumerState<CreateAppraisalTemplateForm> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _cycleController;
  String? _targetDepartment;

  final List<AppraisalQuestion> _questions = [];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _cycleController = TextEditingController();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _cycleController.dispose();
    super.dispose();
  }

  void _addQuestion() {
    setState(() {
      _questions.add(
        AppraisalQuestion(
          id: 'q_${DateTime.now().millisecondsSinceEpoch}',
          text: '',
          order: _questions.length + 1,
        ),
      );
    });
  }

  void _removeQuestion(int index) {
    setState(() => _questions.removeAt(index));
  }

  void _updateQuestionText(int index, String text) {
    setState(() {
      _questions[index] = _questions[index].copyWith(text: text);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _questions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one question')),
      );
      return;
    }

    final template = AppraisalTemplate(
      id: 'tmpl_${DateTime.now().millisecondsSinceEpoch}',
      name: _nameController.text.trim(),
      tenantSlug: widget.tenantSlug,
      cycle: _cycleController.text.trim(),
      targetDepartment: _targetDepartment,
      questions: List.from(_questions),
      createdAt: DateTime.now(),
      createdBy: widget.createdBy,
    );

    ref.read(appraisalProvider.notifier).createTemplate(template);

    widget.onSuccess?.call();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Appraisal template created successfully')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MyCustomTextField(
            controller: _nameController,
            label: 'Template Name',
            placeholder: 'e.g. Annual Performance Review 2026',
            validator: (v) => v?.isEmpty ?? true ? 'Name is required' : null,
          ),
          MyCustomTextField(
            controller: _cycleController,
            label: 'Cycle (e.g. 2026-Q1)',
            placeholder: '2026-Annual',
            validator: (v) => v?.isEmpty ?? true ? 'Cycle is required' : null,
          ),
          MyDropdownField(
            label: 'Target Department (Optional)',
            placeholder: 'All departments',
            items: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations'],
            value: _targetDepartment,
            onChanged: (val) => setState(() => _targetDepartment = val),
          ),

          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Questions', style: TextStyle(fontWeight: FontWeight.bold)),
              ElevatedButton.icon(
                onPressed: _addQuestion,
                icon: const Icon(Icons.add),
                label: const Text('Add Question'),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (_questions.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('No questions added yet'),
              ),
            )
          else
            ReorderableListView.builder(
              shrinkWrap: true,
              itemCount: _questions.length,
              onReorder: (oldIndex, newIndex) {
                setState(() {
                  if (oldIndex < newIndex) newIndex -= 1;
                  final item = _questions.removeAt(oldIndex);
                  _questions.insert(newIndex, item);
                });
              },
              itemBuilder: (context, index) {
                return Card(
                  key: ValueKey(_questions[index].id),
                  child: ListTile(
                    leading: Text('${index + 1}'),
                    title: TextFormField(
                      initialValue: _questions[index].text,
                      decoration: const InputDecoration(
                        hintText: 'Enter question text...',
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (text) => _updateQuestionText(index, text),
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete, color: Colors.red),
                      onPressed: () => _removeQuestion(index),
                    ),
                  ),
                );
              },
            ),

          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submit,
              child: const Text('Create Appraisal Template'),
            ),
          ),
        ],
      ),
    );
  }
}