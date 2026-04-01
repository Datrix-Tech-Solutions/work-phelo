import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../auth_layout.dart';
import '../login_utils/password_requirements.dart';
import '../login_utils/validators.dart';

class SetPasswordPage extends ConsumerStatefulWidget {
  final String tenantSlug;

  const SetPasswordPage({super.key, required this.tenantSlug});

  @override
  ConsumerState<SetPasswordPage> createState() => _SetPasswordPageState();
}

class _SetPasswordPageState extends ConsumerState<SetPasswordPage> {
  bool isLoading = false;

  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  late PasswordStrength _strength;

  @override
  void initState() {
    super.initState();
    _strength = PasswordStrength(password: '', confirmation: '');
    _passwordController.addListener(_updateStrength);
    _confirmController.addListener(_updateStrength);
  }

  @override
  void dispose() {
    _passwordController.removeListener(_updateStrength);
    _confirmController.removeListener(_updateStrength);
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  void _updateStrength() {
    setState(() {
      _strength = PasswordStrength(
        password: _passwordController.text,
        confirmation: _confirmController.text,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            loginImage,
            const SizedBox(height: 40),

            sectionHeader(context, 'Set up your password to continue'),

            Padding(padding: space),
            MyPasswordField(
              label: 'New Password',
              placeholder: 'Create new password',
              controller: _passwordController,
              validator: strictPasswordValidator(),
            ),

            // Strength indicators
            Padding(
              padding: myContentPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _strength.requirements.map((req) {
                  final (text, met) = req;
                  return PasswordRequirement(text: text, met: met);
                }).toList(),
              ),
            ),

            MyPasswordField(
              label: 'Confirm New Password',
              placeholder: 'Re-enter new password',
              controller: _confirmController,
              validator: confirmPasswordValidator(_passwordController.text),
            ),

            Padding(padding: space),
            MyButton(
              btnText: 'Set Password',
              loadingText: 'Setting password...',
              isLoading: isLoading,
              btnOnPressed: () {},
            ),
          ],
        ),
      ),
    );
  }
}
