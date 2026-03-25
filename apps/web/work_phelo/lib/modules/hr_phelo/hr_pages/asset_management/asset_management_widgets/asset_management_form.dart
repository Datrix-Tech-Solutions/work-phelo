import 'package:flutter/material.dart';

import '../../../../../components/app_theme/padding.dart';
import '../../../../../components/form_components/text_fields.dart';
import '../../employee_management/employees/employee_page_wigets.dart/onboarding_form.dart';


class AssetManagementForm extends StatefulWidget {
  const AssetManagementForm({super.key});

  @override
  State<AssetManagementForm> createState() => AssetManagementFormState();
}

class AssetManagementFormState extends State<AssetManagementForm> {
  @override
  Widget build(BuildContext context) {
    return Form(
      child: Column(
        children: [
          sectionHeader(context, ''),
          Padding(padding: space),
          MyCustomTextField(
            label: 'Asset Name',
            placeholder: 'eg. Dell Monitor',
          ),
          MyDropdownField(
            placeholder: 'select type',
            items: ['Monitor', 'Laptop', 'Phone', 'Other'],
            label: 'Asset Type',
          ),
          MyCustomTextField(label: 'Serial Number', placeholder: 'eg. LTP-001'),
          MyDatePicker(placeholder: 'dd/mm/yyyy', label: 'Purchase Date'),
          MyDropdownField(
            placeholder: 'select condition',
            items: ['Excellent', 'Good', 'Fair', 'Poor'],
            label: 'Asset Condition',
          ),
          MyDropdownField(
            placeholder: 'select condition',
            items: ['Available', 'Assigned', 'Maintenance', 'Retired'],
            label: 'Availability',
          ),
        ],
      ),
    );
  }
}
