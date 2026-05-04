import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../auth_layout.dart';
import '../login_utils/validators.dart';
import '../login_pages/tenant_login_page.dart';
import 'otp_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../work_phelo_funtions/work_phelo_login_functions/authentication_service.dart';

class EmailConfirmation extends ConsumerStatefulWidget {
  final String tenantSlug;
  const EmailConfirmation({super.key, this.tenantSlug = ''});

  @override
  ConsumerState<EmailConfirmation> createState() => _EmailConfirmationState();
}

class _EmailConfirmationState extends ConsumerState<EmailConfirmation> {
  bool isLoading = false;
  String? _errorMessage;

  final _formKey = GlobalKey<FormState>();
  final emailController = TextEditingController();

  @override
  void dispose() {
    emailController.dispose();
    super.dispose();
  }

  Future<void> _sendResetCode() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      isLoading = true;
      _errorMessage = null;
    });

    final email = emailController.text.trim();

    try {
      final dio = ref.read(dioProvider);
      await dio.post('/auth/forgot-password', data: {
        'email': email,
        'tenantSlug': widget.tenantSlug,
      });

      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ResetPasswordCodePage(
            email: email,
            tenantSlug: widget.tenantSlug,
            role: 'user',
            fullName: '',
            companyName: '',
          ),
        ),
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      String msg = 'Failed to send code. Try again.';
      if (data is Map && data['message'] != null) {
        msg = data['message'].toString();
      }
      setState(() => _errorMessage = msg);
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            appImage,
            Text('Reset Password', style: myTitleTextStyle(context)),
            Padding(padding: space),
            Text(
              'Enter your email to receive a password reset code',
              style: myMainTextStyle(context).copyWith(
                fontWeight: FontWeight.normal,
                color: ColorScheme.of(context).outline,
              ),
            ),
            if (_errorMessage != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            const SizedBox(height: 16),
            MyCustomTextField(
              label: 'Email',
              placeholder: 'Enter your email',
              controller: emailController,
              validator: emailValidator,
              keyType: TextInputType.emailAddress,
              textAction: TextInputAction.done,
            ),
            MyButton(
              btnText: 'Send Code',
              loadingText: 'Sending...',
              isLoading: isLoading,
              btnOnPressed: _sendResetCode,
            ),
            Align(
              alignment: Alignment.center,
              child: TextButton(
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (context) =>
                          TenantLoginPage(tenantSlug: widget.tenantSlug),
                    ),
                  );
                },
                style: TextButton.styleFrom(
                  overlayColor: Colors.transparent,
                  splashFactory: NoSplash.splashFactory,
                ),
                child: Text(
                  'Go back to login',
                  style: myNoInfoStyle(context)
                      .copyWith(color: Colors.lightBlueAccent),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class EmailConfirmationForReset extends EmailConfirmation {
  const EmailConfirmationForReset({super.key, super.tenantSlug});
}
