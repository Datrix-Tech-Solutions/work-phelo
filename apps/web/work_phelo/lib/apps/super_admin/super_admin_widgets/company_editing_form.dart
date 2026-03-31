import 'package:flutter/material.dart';
import 'package:work_phelo/work_phelo_components/widgets/form_components/app_text_fields.dart';

class CompanyEditingForm extends StatefulWidget {
  const CompanyEditingForm({super.key});

  @override
  State<CompanyEditingForm> createState() => CompanyEditingFormState();
}

class CompanyEditingFormState extends State<CompanyEditingForm> {
  final _editingFormKey = GlobalKey<FormState>();
  String? _selectedIndustry;
  String? _selectedCompanySize;
  @override
  Widget build(BuildContext context) {
    return Form(
      key: _editingFormKey,
      child: Column(
        children: [
          MyCustomTextField(
            label: 'Company Name',
            placeholder: 'currentcompanyname',
          ),
          MyCustomTextField(
            label: 'Company Location',
            placeholder: 'currentcompanylocation',
          ),
          MyCustomTextField(
            label: 'Company Country',
            placeholder: 'currentcompanycountry',
          ),

          MyDropdownField(
            label: 'Company Size',
            placeholder: 'currentcompanysize',
            items: const [
              '0 - 10',
              '11 - 50',
              '50 - 100',
              '100 - 200',
              '200 - 500',
              '500 +',
            ],
            initialValue: _selectedCompanySize,
            onChanged: (v) => setState(() => _selectedCompanySize = v),
          ),
          MyDropdownField(
            label: 'Company Industry',
            placeholder: 'currentcompanyindustry',
            items: const [
              'Technology / Engineering',
              'Healthcare / Medical',
              'Fintech / Banking / Finance',
              'Manufacturing',
              'Telecommunication',
              'Retail',
              'Transportation / Logistics',
              'Legal Services',
              'Education',
              'Other',
            ],
            initialValue: _selectedIndustry,
            onChanged: (v) => setState(() => _selectedIndustry = v),
          ),

          if (_selectedIndustry == 'Other')
            MyCustomTextField(
              label: 'Other Industry',
              placeholder: 'otherindustry',
            ),
        ],
      ),
    );
  }
}
