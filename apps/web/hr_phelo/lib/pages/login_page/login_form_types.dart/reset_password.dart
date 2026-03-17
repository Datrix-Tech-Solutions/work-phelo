import 'package:flutter/material.dart';
import 'package:hr_phelo/components/app_theme/padding.dart';
import 'package:hr_phelo/components/app_theme/text_styles.dart';
import 'package:hr_phelo/pages/login_page/auth_layout.dart';
import 'package:hr_phelo/pages/login_page/login_form_types.dart/login_page.dart';

import '../../../Components/Form_Components/text_fields.dart';
import '../../../components/app_theme/app_images.dart';
import '../../../components/app_widgets/snack_bar.dart';
import '../../../components/form_components/my_buttons.dart';
import '../login_utils/password_requirements.dart';
import '../login_utils/validators.dart';

class ResetPassword extends StatefulWidget {
  const ResetPassword({super.key});

  @override
  State<ResetPassword> createState() => _ResetPasswordState();
}

class _ResetPasswordState extends State<ResetPassword> {
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

  bool _showLoginState = false;
  String? _errorMessage;

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => isLoading = true);

    try {
      // TODO: Password reset API
      await Future.delayed(const Duration(seconds: 2));

      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginPage()),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _showLoginState = true;
        _errorMessage = "Error: ${e.toString()}";
        Future.delayed(const Duration(seconds: 5), () {
          if (mounted) setState(() => _showLoginState = false);
        });
      });
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return AuthLayout(
      stateBanner: _showLoginState
          ? MySnackBar(
              snackMessage: _errorMessage ?? "an error occured",
              snackIcon: Icons.error_outline_rounded,
              snackColor: Colors.red,
            )
          : null,
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            appImage,
            Padding(padding: space),
            Text(
              'Set your new password',
              style: myLargeTextStyle(context),
              textAlign: TextAlign.center,
            ),

            Text(
              'Enter a new password',
              style: myMainTextStyle(
                context,
              ).copyWith(color: colorScheme.outline),
              textAlign: TextAlign.center,
            ),

            MyPasswordField(
              label: 'New Password',
              placeholder: 'Create new password',
              controller: _passwordController,
              validator: strictPasswordValidator(),
            ),

            // Strength indicators
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
              loadingText: 'Updating...',
              isLoading: isLoading,
              btnOnPressed: _handleSubmit,
            ),
          ],
        ),
      ),
    );
  }
}
