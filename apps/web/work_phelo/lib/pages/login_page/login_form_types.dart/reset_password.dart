import 'package:flutter/material.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../work_phelo_components/widgets/misc/snack_bar.dart';
import '../auth_layout.dart';
import '../login_utils/password_requirements.dart';
import '../login_utils/validators.dart';
import '../login_pages/tenant_login_page.dart';

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
        MaterialPageRoute(builder: (_) => const TenantLoginPage()),
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
