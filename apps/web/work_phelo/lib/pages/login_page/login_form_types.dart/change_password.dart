import 'package:flutter/material.dart';

import '../../../Components/Form_Components/text_fields.dart';
import '../../../Components/app_theme/text_styles.dart';
import '../../../components/app_theme/app_images.dart';
import '../../../components/app_theme/padding.dart';
import '../../../components/form_components/my_buttons.dart';
import '../../../Modules/dashboard.dart';
import '../auth_layout.dart';
import '../login_utils/password_requirements.dart';
import '../login_utils/validators.dart';

class ChangePassword extends StatefulWidget {
  const ChangePassword({super.key});

  @override
  State<ChangePassword> createState() => _ChangePasswordState();
}

class _ChangePasswordState extends State<ChangePassword> {
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

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => isLoading = true);

    try {
      // TODO: Password reset API
      await Future.delayed(const Duration(seconds: 2));

      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const DashboardPage()),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      child: Form(
        child: Column(
          children: [
            appImage,
            Text('Set your new password', style: myLargeTextStyle(context)),
            Padding(padding: space),
            Text(
              'For security reasons you must create a new\npassword before accessing your workspace.',
            ),
            MyPasswordField(
              label: 'Current Password',
              placeholder: 'Enter your current password',
              validator: basicPasswordValidator(),
            ),
            MyPasswordField(
              label: 'New Password',
              placeholder: 'Create new password',
              controller: _passwordController,
              validator: strictPasswordValidator(),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _strength.requirements.map((req) {
                final (text, met) = req;
                return PasswordRequirement(text: text, met: met);
              }).toList(),
            ),
            MyPasswordField(
              label: 'Confirm New Password',
              placeholder: 'Re-enter new password',
              controller: _confirmController,
              validator: confirmPasswordValidator(_passwordController.text),
            ),

            Padding(padding: space),

            MyButton(
              btnText: 'Update Password',
              loadingText: 'Password Updating...',
              isLoading: isLoading,
              btnOnPressed: _handleSubmit,
            ),
          ],
        ),
      ),
    );
  }
}
