import 'package:flutter/material.dart';
import 'package:hr_phelo/components/app_theme/padding.dart';
import 'package:hr_phelo/components/app_theme/text_styles.dart';
import 'package:hr_phelo/components/form_components/my_buttons.dart';
import 'package:hr_phelo/components/form_components/text_fields.dart';
import 'package:hr_phelo/pages/login_page/login_utils/validators.dart';
import 'package:unicons/unicons.dart';

class OnboardingForm extends StatefulWidget {
  const OnboardingForm({super.key});

  @override
  State<OnboardingForm> createState() => _OnboardingFormState();
}

class _OnboardingFormState extends State<OnboardingForm> {
  final _formKey = GlobalKey<FormState>();

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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionHeader(context, 'Personal Information'),
            const SizedBox(height: 16),

            Wrap(
              runSpacing: 20,
              spacing: 24,
              children: [
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    controller: _firstNameController,
                    label: 'First Name',
                    placeholder: 'John',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    controller: _lastNameController,
                    label: 'Last Name',
                    placeholder: 'Doe',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
              ],
            ),
            Wrap(
              runSpacing: 20,
              spacing: 24,
              children: [
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    label: 'Phone Number',
                    placeholder: '+233 20 123 4567',
                    keyType: TextInputType.phone,
                  ),
                ),
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    controller: _emailController,
                    label: 'Email Address',
                    placeholder: 'john.doe@company.com',
                    keyType: TextInputType.emailAddress,
                    validator: emailValidator,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 40),

            _buildSectionHeader(context, 'Role & Department'),
            const SizedBox(height: 16),

            Wrap(
              runSpacing: 20,
              spacing: 24,
              children: [
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    label: 'Job Role',
                    placeholder: 'Enter Role',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    label: 'Job Role',
                    placeholder: 'Enter Role',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
              ],
            ),
            Wrap(
              runSpacing: 20,
              spacing: 24,
              children: [
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    label: 'Job Role',
                    placeholder: 'Enter Role',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    label: 'Job Role',
                    placeholder: 'Enter Role',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 40),

            _buildSectionHeader(context, 'Employment Details'),
            const SizedBox(height: 16),

            Wrap(
              runSpacing: 20,
              spacing: 24,
              children: [
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    label: 'Date of hire',
                    placeholder: 'dd/mm/yyy',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
                SizedBox(
                  width: 320,
                  child: MyCustomTextField(
                    label: 'Employment Type',
                    placeholder: 'Full time',
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ),
              ],
            ),
            SizedBox(
              width: 320,
              child: MyCustomTextField(
                label: 'Annual Salary (GHS)',
                placeholder: 'e.g. 48,000',
                keyType: TextInputType.number,
                prefixText: 'GHS ',
              ),
            ),

            const SizedBox(height: 48),

            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                MyOutlinedButton(
                  btnText: 'Reset',
                  btnIcon: UniconsLine.trash_alt,
                  btnAccent: colorScheme.error,
                  isHovered: false,
                  onPressed: () {
                    _formKey.currentState?.reset();
                  },
                ),
                Padding(padding: myContentPadding),
                MyOutlinedButton(
                  btnText: 'Onboard Employee',
                  btnIcon: UniconsLine.user_plus,
                  btnAccent: colorScheme.primary,
                  isHovered: false,
                  onPressed: () {
                    _formKey.currentState?.reset();
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
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
