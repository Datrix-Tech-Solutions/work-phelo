import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:unicons/unicons.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../work_phelo_components/widgets/misc/snack_bar.dart';
import '../../../work_phelo_funtions/work_phelo_login_functions/authentication_service.dart';
import '../auth_layout.dart';
import '../login_utils/password_requirements.dart';
import '../login_utils/validators.dart';

class SetPasswordPage extends ConsumerStatefulWidget {
  final String tenantSlug;
  final String token;

  const SetPasswordPage({
    super.key,
    required this.tenantSlug,
    this.token = '',
  });

  @override
  ConsumerState<SetPasswordPage> createState() => _SetPasswordPageState();
}

class _SetPasswordPageState extends ConsumerState<SetPasswordPage> {
  bool isLoading = false;
  String? _errorMessage;
  String? _successMessage;

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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_passwordController.text != _confirmController.text) {
      setState(() => _errorMessage = 'Passwords do not match.');
      return;
    }

    if (widget.token.isEmpty) {
      setState(() => _errorMessage = 'Invalid or missing invite token.');
      return;
    }

    setState(() {
      isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final dio = ref.read(dioProvider);
      await dio.post('/auth/users/accept-invite', data: {
        'inviteToken': widget.token,
        'password': _passwordController.text,
      });

      if (mounted) {
        setState(() => _successMessage = 'Password set! Redirecting...');
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted) context.go('/${widget.tenantSlug}/login');
        });
      }
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['message'] as String?;
      setState(() => _errorMessage = msg ?? 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      stateBanner: _errorMessage != null
          ? MySnackBar(
              snackMessage: _errorMessage!,
              snackIcon: UniconsLine.times_circle,
              snackColor: Colors.red,
            )
          : _successMessage != null
              ? MySnackBar(
                  snackMessage: _successMessage!,
                  snackIcon: UniconsLine.check_circle,
                  snackColor: Colors.green,
                )
              : null,
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
              btnOnPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
