import 'package:flutter/material.dart';
import 'package:work_phelo/work_phelo_components/widgets/form_components/app_text_fields.dart';

class AdminUpdateForm extends StatefulWidget {
  const AdminUpdateForm({super.key});

  @override
  State<AdminUpdateForm> createState() => AdminUpdateFormState();
}

class AdminUpdateFormState extends State<AdminUpdateForm> {
  final _adminEditingFormKey = GlobalKey<FormState>();
  @override
  Widget build(BuildContext context) {
    return Form(
      key: _adminEditingFormKey,
      child: Column(
        children: [
          MyCustomTextField(label: 'First name', placeholder: 'firstname'),
          MyCustomTextField(label: 'Last name', placeholder: 'lastname'),
          MyCustomTextField(
            label: 'Email',
            placeholder: 'email@companydomain.com',
          ),
        ],
      ),
    );
  }
}
