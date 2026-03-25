import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';
import 'package:work_phelo/functions/super_admin_functions/company_model.dart';

import '../../../components/form_components/text_fields.dart';
import '../../../Modules/hr_phelo/hr_pages/employee_management/employees/employee_page_wigets.dart/onboarding_form.dart';
import '../../../pages/login_page/login_utils/validators.dart';

class CompanyOnboardingForm extends StatefulWidget {
  final AppUser currentUser;
  const CompanyOnboardingForm({super.key, required this.currentUser});

  @override
  State<CompanyOnboardingForm> createState() => CompanyOnboardingFormState();
}

class CompanyOnboardingFormState extends State<CompanyOnboardingForm> {
  final _formKey = GlobalKey<FormState>();

  // ── Controllers ───────────────────────────────────────────────
  final _companyNameController = TextEditingController();
  final _companyContactController = TextEditingController();
  final _companyLocationController = TextEditingController();
  final _adminFirstNameController = TextEditingController();
  final _adminLastNameController = TextEditingController();
  final _adminContactController = TextEditingController();
  final _adminEmailController = TextEditingController();
  final _otherIndustryController = TextEditingController();

  String? _selectedIndustry;
  String? _selectedCompanySize;

  @override
  void dispose() {
    _companyNameController.dispose();
    _companyContactController.dispose();
    _companyLocationController.dispose();
    _adminFirstNameController.dispose();
    _adminLastNameController.dispose();
    _adminContactController.dispose();
    _adminEmailController.dispose();
    _otherIndustryController.dispose();
    super.dispose();
  }

  // ── Called by the Submit button outside the form ──────────────
  CompanyModel? submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return null;

    return CompanyModel(
      companyName: _companyNameController.text.trim(),
      companyContact: _companyContactController.text.trim(),
      companySize: _selectedCompanySize,
      companyLocation: _companyLocationController.text.trim(),
      companyIndustry: _selectedIndustry == 'Other'
          ? _otherIndustryController.text.trim()
          : _selectedIndustry,
      adminFirstName: _adminFirstNameController.text.trim(),
      adminLastName: _adminLastNameController.text.trim(),
      adminContact: _adminContactController.text.trim(),
      adminEmail: _adminEmailController.text.trim(),
      onboardedDate: DateTime.now(),
      systemRole: 'platform_owner',
      adminPassword: 'Platformpass@1',
    );
  }

  // ── Called by the Reset button outside the form ───────────────
  void reset() {
    _formKey.currentState?.reset();
    _companyNameController.clear();
    _companyContactController.clear();
    _companyLocationController.clear();
    _adminFirstNameController.clear();
    _adminLastNameController.clear();
    _adminContactController.clear();
    _adminEmailController.clear();
    _otherIndustryController.clear();
    setState(() {
      _selectedIndustry = null;
      _selectedCompanySize = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    const double csize = 0.35;
    return Form(
      key: _formKey,
      child: Center(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              sectionHeader(context, 'Company Information'),
              const SizedBox(height: 5),
              Wrap(
                children: [
                  _field(
                    context,
                    csize * 2,
                    MyCustomTextField(
                      label: 'Company Name',
                      placeholder: 'Companyname limited',
                      controller: _companyNameController,
                      validator: (v) => v?.trim().isEmpty ?? true
                          ? 'This field is Required'
                          : null,
                    ),
                  ),
                ],
              ),
              Wrap(
                children: [
                  _field(
                    context,
                    csize,
                    MyCustomTextField(
                      label: 'Company Contact',
                      placeholder: '+233 20 123 4567',
                      controller: _companyContactController,
                      keyType: TextInputType.phone,
                      inputType: [
                        FilteringTextInputFormatter.allow(RegExp(r'[\d\s+]')),
                      ],
                      textLenght: 10,
                    ),
                  ),
                  _field(
                    context,
                    csize,
                    MyDropdownField(
                      label: 'Company Size',
                      placeholder: 'Select company size',
                      items: const [
                        '0 - 10',
                        '11 - 50',
                        '50 - 100',
                        '100 - 200',
                        '200 - 500',
                        '500 +',
                      ],
                      initialValue: _selectedCompanySize,
                      onChanged: (v) =>
                          setState(() => _selectedCompanySize = v),
                    ),
                  ),
                ],
              ),
              Wrap(
                children: [
                  _field(
                    context,
                    csize,
                    MyCustomTextField(
                      label: 'Company Location',
                      placeholder: 'location',
                      controller: _companyLocationController,
                    ),
                  ),
                  _field(
                    context,
                    csize,
                    MyDropdownField(
                      label: 'Company Industry',
                      placeholder: 'Select an Industry',
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
                  ),
                  if (_selectedIndustry == 'Other')
                    _field(
                      context,
                      csize,
                      MyCustomTextField(
                        label: 'Other Industry',
                        placeholder: 'Specify industry',
                        controller: _otherIndustryController,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              sectionHeader(context, 'Administrator Information'),
              const SizedBox(height: 5),
              Wrap(
                children: [
                  _field(
                    context,
                    csize * 2,
                    MyCustomTextField(
                      label: 'Administrator First Name',
                      placeholder: 'John',
                      controller: _adminFirstNameController,
                      validator: (v) =>
                          v?.trim().isEmpty ?? true ? 'Required' : null,
                    ),
                  ),
                ],
              ),
              Wrap(
                children: [
                  _field(
                    context,
                    csize * 2,
                    MyCustomTextField(
                      label: 'Administrator Last Name',
                      placeholder: 'Doe',
                      controller: _adminLastNameController,
                      validator: (v) =>
                          v?.trim().isEmpty ?? true ? 'Required' : null,
                    ),
                  ),
                ],
              ),
              Wrap(
                children: [
                  _field(
                    context,
                    csize,
                    MyCustomTextField(
                      label: 'Administrator Contact',
                      placeholder: '+233 20 123 4567',
                      controller: _adminContactController,
                      keyType: TextInputType.phone,
                      inputType: [
                        FilteringTextInputFormatter.allow(RegExp(r'[\d\s+]')),
                      ],
                      textLenght: 10,
                    ),
                  ),
                  _field(
                    context,
                    csize,
                    MyCustomTextField(
                      label: 'Admin Email Address',
                      placeholder: 'john.doe@company.com',
                      controller: _adminEmailController,
                      keyType: TextInputType.emailAddress,
                      validator: emailValidator,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────
  Widget _field(BuildContext context, double csize, Widget child) {
    return SizedBox(
      width: MediaQuery.sizeOf(context).width * csize,
      child: child,
    );
  }
}
