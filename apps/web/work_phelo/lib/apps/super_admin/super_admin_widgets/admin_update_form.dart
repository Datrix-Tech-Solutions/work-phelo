import 'package:flutter/material.dart';
import 'package:work_phelo/work_phelo_components/widgets/form_components/app_text_fields.dart';

class AdminUpdateForm extends StatefulWidget {
  const AdminUpdateForm({super.key});

  @override
  State<AdminUpdateForm> createState() => AdminUpdateFormState();
}

class AdminUpdateFormState extends State<AdminUpdateForm> {
  final _adminEditingFormKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Map<String, String>? submit() {
    if (!_adminEditingFormKey.currentState!.validate()) return null;
    return {
      'firstName': _firstNameController.text.trim(),
      'lastName': _lastNameController.text.trim(),
      'email': _emailController.text.trim(),
    };
  }

  void reset() {
    _firstNameController.clear();
    _lastNameController.clear();
    _emailController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _adminEditingFormKey,
      child: Column(
        children: [
          MyCustomTextField(
            label: 'First name',
            placeholder: 'firstname',
            controller: _firstNameController,
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          MyCustomTextField(
            label: 'Last name',
            placeholder: 'lastname',
            controller: _lastNameController,
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          MyCustomTextField(
            label: 'Email',
            placeholder: 'email@companydomain.com',
            controller: _emailController,
            keyType: TextInputType.emailAddress,
            validator: (v) {
              if (v == null || v.isEmpty) return 'Required';
              if (!v.contains('@')) return 'Enter a valid email';
              return null;
            },
          ),
        ],
      ),
    );
  }
}
