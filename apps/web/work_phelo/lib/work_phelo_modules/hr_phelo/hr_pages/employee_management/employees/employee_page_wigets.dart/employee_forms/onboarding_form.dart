import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../../../../pages/login_page/login_utils/validators.dart';
import '../../../../../../../work_phelo_components/theme/app_padding.dart';
import '../../../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';

class OnboardingForm extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
  const OnboardingForm({super.key, required this.currentUser});

  @override
  ConsumerState<OnboardingForm> createState() => OnboardingFormState();
}

class OnboardingFormState extends ConsumerState<OnboardingForm> {
  final _formKey = GlobalKey<FormState>();

  // ── Controllers ──────────────────────────────────────────────
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _jobTitleController = TextEditingController();
  final _salaryController = TextEditingController();

  // ── Dropdown state ───────────────────────────────────────────
  String? _selectedDepartmentId;
  String? _selectedEmploymentType;
  String? _selectedAsset;
  DateTime? _hireDate;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _jobTitleController.dispose();
    _salaryController.dispose();
    _hireDate = null;
    super.dispose();
  }

  void reset() {
    _formKey.currentState?.reset();
    _firstNameController.clear();
    _lastNameController.clear();
    _phoneController.clear();
    _emailController.clear();
    _jobTitleController.clear();
    _salaryController.clear();
    setState(() {
      _selectedDepartmentId = null;
      _selectedEmploymentType = null;
      _selectedAsset = null;
      _hireDate = null;
    });
  }

  EmployeeModel? submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return null;
    if (_hireDate == null) {
      return null;
    }
    if (_selectedEmploymentType == null) {
      return null;
    }

    final user = EmployeeModel(
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      contact: _phoneController.text.trim(),
      email: _emailController.text.trim(),
      password: 'Password55',
      department: null,
      jobTitle: _jobTitleController.text.trim(),
      systemRole: ['employee'],
      hiredDate: _hireDate!,
      employmentType: _selectedEmploymentType!,
      annualSalary:
          double.tryParse(_salaryController.text.replaceAll(',', '')) ?? 0.0,
      asset: _selectedAsset,
      tenantSlug: widget.currentUser.tenantSlug,
    );

    ref.read(userProvider.notifier).addUser(user);

    if (_selectedDepartmentId != null) {
      ref
          .read(departmentProvider.notifier)
          .addMember(_selectedDepartmentId!, user.email);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final departments = ref.watch(
      departmentsByTenantProvider(widget.currentUser.tenantSlug),
    );

    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            sectionHeader(context, 'Personal Information'),
            MyCustomTextField(
              label: 'First Name',
              placeholder: 'John',
              controller: _firstNameController,
              validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
            ),
            MyCustomTextField(
              label: 'Last Name',
              placeholder: 'Doe',
              controller: _lastNameController,
              validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
            ),

            MyCustomTextField(
              label: 'Phone Number',
              placeholder: '+233 20 123 4567',
              controller: _phoneController,
              keyType: TextInputType.phone,
              inputType: [
                FilteringTextInputFormatter.allow(RegExp(r'[\d\s+]')),
              ],
              textLenght: 10,
            ),
            MyCustomTextField(
              label: 'Email Address',
              placeholder: 'john.doe@company.com',
              controller: _emailController,
              keyType: TextInputType.emailAddress,
              validator: emailValidator,
            ),

            const SizedBox(height: 20),
            sectionHeader(context, 'Role & Department'),

            if (departments.isNotEmpty) ...[
              MyDropdownField(
                label: 'Department',
                placeholder: 'Assign to department',
                items: departments.map((d) => d.name).toList(),
                initialValue: departments
                    .where((d) => d.id == _selectedDepartmentId)
                    .map((d) => d.name)
                    .firstOrNull,
                onChanged: (name) {
                  final match = departments
                      .where((d) => d.name == name)
                      .firstOrNull;
                  setState(() {
                    _selectedDepartmentId = match?.id;
                  });
                },
              ),
            ] else ...[
              Padding(
                padding: space,
                child: sectionHeader(context, 'You have no departments'),
              ),

              Padding(padding: space),
            ],
            MyCustomTextField(
              label: 'Job Title',
              placeholder: 'Enter job title',
              controller: _jobTitleController,
              validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
            ),

            const SizedBox(height: 20),
            sectionHeader(context, 'Employment Details'),
            MyDatePicker(
              label: 'Date of Hire',
              placeholder: 'mm/dd/yyyy',
              lastDate: DateTime.now(),
              onDateSelected: (date) => setState(() => _hireDate = date),
            ),

            MyDropdownField(
              label: 'Employment Type',
              placeholder: 'Select type',
              items: ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
              initialValue: _selectedEmploymentType,
              onChanged: (v) => setState(() => _selectedEmploymentType = v),
            ),
          ],
        ),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────
}

