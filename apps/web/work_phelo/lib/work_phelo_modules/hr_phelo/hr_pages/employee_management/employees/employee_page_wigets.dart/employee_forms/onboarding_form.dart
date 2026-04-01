import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import '../../../../../../../pages/login_page/login_utils/validators.dart';
import '../../../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../../../../../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';

class OnboardingForm extends ConsumerStatefulWidget {
  const OnboardingForm({super.key});

  @override
  ConsumerState<OnboardingForm> createState() => OnboardingFormState();
}

class OnboardingFormState extends ConsumerState<OnboardingForm> {
  final _formKey = GlobalKey<FormState>();

  // Controllers
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _jobTitleController = TextEditingController();

  // State
  String? _selectedDepartmentId;
  String? _selectedEmploymentType;
  DateTime? _hireDate;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _jobTitleController.dispose();
    super.dispose();
  }

  // This is the method called by the panel's onPressed
  Future<EmployeeModel?> submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return null;

    final authState = ref.read(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Session expired')));
      return null;
    }

    final employee = EmployeeModel(
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      email: _emailController.text.trim(),
      contact: _phoneController.text.trim(),
      jobTitle: _jobTitleController.text.trim(),
      systemRole: ['EMPLOYEE'],
      hiredDate: _hireDate ?? DateTime.now(),
      employmentType: _selectedEmploymentType ?? 'Full-Time',
      password: '',
      tenantSlug: currentUser.tenantSlug,
      status: EmploymentStatus.pending,
    );

    try {
      // Call the real backend invite
      await ref
          .read(userProvider.notifier)
          .inviteEmployee(
            tenantSlug: currentUser.tenantSlug,
            employee: employee,
          );

      return employee; // Return success to panel
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red,
        ),
      );
      return null;
    }
  }

  void reset() {
    _formKey.currentState?.reset();
    _firstNameController.clear();
    _lastNameController.clear();
    _emailController.clear();
    _phoneController.clear();
    _jobTitleController.clear();
    setState(() {
      _selectedDepartmentId = null;
      _selectedEmploymentType = null;
      _hireDate = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser == null) {
      return const Center(child: Text("Please login again"));
    }

    final departments = ref.watch(
      departmentsByTenantProvider(currentUser.tenantSlug),
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
              label: 'Email Address',
              placeholder: 'john.doe@acmeghana.com',
              controller: _emailController,
              keyType: TextInputType.emailAddress,
              validator: emailValidator,
            ),

            MyCustomTextField(
              label: 'Phone Number',
              placeholder: '+233 20 123 4567',
              controller: _phoneController,
              keyType: TextInputType.phone,
            ),

            const SizedBox(height: 24),
            sectionHeader(context, 'Role & Department'),

            if (departments.isNotEmpty)
              MyDropdownField(
                label: 'Department',
                placeholder: 'Assign to department',
                items: departments.map((d) => d.name).toList(),
                initialValue: departments
                    .where((d) => d.id == _selectedDepartmentId)
                    .map((d) => d.name)
                    .firstOrNull,
                onChanged: (name) {
                  final match = departments.firstWhereOrNull(
                    (d) => d.name == name,
                  );
                  setState(() => _selectedDepartmentId = match?.id);
                },
              ),

            MyCustomTextField(
              label: 'Job Title',
              placeholder: 'Procurement Officer',
              controller: _jobTitleController,
              validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
            ),

            const SizedBox(height: 24),
            sectionHeader(context, 'Employment Details'),

            MyDatePicker(
              label: 'Date of Hire',
              placeholder: 'dd/mm/yyyy',
              lastDate: DateTime.now(),
              onDateSelected: (date) => setState(() => _hireDate = date),
            ),

            MyDropdownField(
              label: 'Employment Type',
              placeholder: 'Select type',
              items: const ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
              initialValue: _selectedEmploymentType,
              onChanged: (v) => setState(() => _selectedEmploymentType = v),
            ),
          ],
        ),
      ),
    );
  }
}
