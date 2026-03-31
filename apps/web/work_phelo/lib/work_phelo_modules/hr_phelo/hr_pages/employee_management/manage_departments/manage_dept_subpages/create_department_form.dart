import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

import '../../../../../../work_phelo_components/theme/app_padding.dart';
import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../../../../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';

class CreateDepartmentForm extends ConsumerStatefulWidget {
  const CreateDepartmentForm({super.key});

  @override
  ConsumerState<CreateDepartmentForm> createState() =>
      CreateDepartmentFormState();
}

class CreateDepartmentFormState extends ConsumerState<CreateDepartmentForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();

  Color _selectedColor = departmentColors.first;
  IconData _selectedIcon = departmentIcons.first;
  String? _selectedHeadEmail;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Get current user from Riverpod instead of widget
    final authState = ref.read(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('User not found')));
      return;
    }
    

    final dept = CompanyDepartmentsModel(
      id: generateDepartmentId(_nameController.text),
      name: _nameController.text.trim(),
      tenantSlug: currentUser.tenantSlug,
      color: _selectedColor,
      icon: _selectedIcon,
      headEmail: _selectedHeadEmail,
      memberEmails: _selectedHeadEmail != null ? [_selectedHeadEmail!] : [],
    );

    ref.read(departmentProvider.notifier).addDepartment(dept);

    // Close the panel after successful creation
    Navigator.of(context).pop(); // This closes the side panel
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Department created successfully')),
    );
  }

  void reset() {
  _formKey.currentState?.reset();
  _nameController.clear();
  setState(() {
    _selectedColor = departmentColors.first;
    _selectedIcon = departmentIcons.first;
    _selectedHeadEmail = null;
  });
}

  @override
  Widget build(BuildContext context) {
    // Watch tenant users using current user's tenantSlug
    // final authState = ref.watch(authNotifierProvider);
    // final currentUser = authState.user;
    // final tenantUsers = currentUser != null
    //     ? ref.watch(usersByTenantProvider(currentUser.tenantSlug))
    //     : <AppUserModel>[];
    final tenantUsers = <AppUserModel>[];

    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Department Name
            _field(
              context,
              1,
              MyCustomTextField(
                label: 'Department name',
                placeholder: 'e.g. Engineering',
                controller: _nameController,
                validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
              ),
            ),

            // Color & Icon Picker
            Container(
              padding: formPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),
                  _sectionHeader(context, 'Color'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: departmentColors.map((c) {
                      final isSelected = c == _selectedColor;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedColor = c),
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: c,
                            shape: BoxShape.circle,
                            border: isSelected
                                ? Border.all(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.onSurface,
                                    width: 2.5,
                                  )
                                : null,
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 24),
                  _sectionHeader(context, 'Icon'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: departmentIcons.map((icon) {
                      final isSelected = icon == _selectedIcon;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedIcon = icon),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? _selectedColor.withAlpha(30)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(appRadius),
                            border: Border.all(
                              color: isSelected
                                  ? _selectedColor
                                  : Theme.of(
                                      context,
                                    ).colorScheme.outlineVariant,
                              width: 0.5,
                            ),
                          ),
                          child: Icon(icon, size: 18, color: _selectedColor),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),

            // Department Head (Optional)
            const SizedBox(height: 16),
            _field(
              context,
              1,
              MyDropdownField(
                label: 'Department head (optional)',
                placeholder: 'Select department head',
                items: tenantUsers.map((u) => u.fullName).toList(),
                initialValue: tenantUsers
                    .where((u) => u.email == _selectedHeadEmail)
                    .map((u) => u.fullName)
                    .firstOrNull,
                onChanged: (name) {
                  if (name == null) {
                    setState(() => _selectedHeadEmail = null);
                    return;
                  }
                  // Match by email via name lookup — safe because list is scoped to tenant
                  final match = tenantUsers
                      .where((u) => u.fullName == name)
                      .firstOrNull;
                  setState(() => _selectedHeadEmail = match?.email);
                },
              ),
            ),

            
          ],
        ),
      ),
    );
  }

  Widget _field(BuildContext context, double csize, Widget child) {
    return SizedBox(
      width: MediaQuery.sizeOf(context).width * csize,
      child: child,
    );
  }

  Widget _sectionHeader(BuildContext context, String title) {
    return Text(
      title.toUpperCase(),
      style: myMainTextStyle(context).copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.1,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }
}
