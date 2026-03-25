import 'package:flutter/material.dart';
import '../../../Components/app_theme/text_styles.dart';
import '../../../components/app_theme/app_images.dart';
import '../../../components/app_theme/padding.dart';
import '../../../components/form_components/my_buttons.dart';
import '../../../components/form_components/text_fields.dart';
import '../auth_layout.dart';
import '../login_utils/validators.dart';
import 'login_page.dart';
import 'otp_page.dart';

class EmailConfirmation extends StatefulWidget {
  const EmailConfirmation({super.key});

  @override
  State<EmailConfirmation> createState() => _EmailConfirmationState();
}

class _EmailConfirmationState extends State<EmailConfirmation> {
  bool isLoading = false;

  final _formKey = GlobalKey<FormState>();
  final emailController = TextEditingController();

  @override
  void dispose() {
    emailController.dispose();
    super.dispose();
  }

  void _showMessage(String message, {required bool isSuccess}) {
    setState(() {});

    Future.delayed(const Duration(seconds: 5), () {});
  }

  Future<void> _sendResetCode() async {
    if (!_formKey.currentState!.validate()) return;

    final navigator = Navigator.of(context);

    setState(() {
      isLoading = true;
    });

    try {
      await Future.delayed(const Duration(milliseconds: 1800));

      if (!mounted) return;

      final enteredEmail = emailController.text.trim();

      _showMessage(
        "A reset code has been sent to $enteredEmail",
        isSuccess: true,
      );

      navigator.pushReplacement(
        MaterialPageRoute(
          builder: (_) => ResetPasswordCodePage(
            email: enteredEmail,
            role: 'user',
            fullName: 'fullName',
            companyName: 'Company Name',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      _showMessage("Failed to send code. Try again.", isSuccess: false);
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
        key: _formKey,
        child: Column(
          children: [
            appImage,
            Text('Reset Password', style: myTitleTextStyle(context)),
            Padding(padding: space),
            Text(
              'please enter your email to recieve a password reset code',
              style: myMainTextStyle(context).copyWith(
                fontWeight: FontWeight.normal,
                color: ColorScheme.of(context).outline,
              ),
            ),
            SizedBox(height: 16),
            MyCustomTextField(
              label: 'Email',
              placeholder: 'please enter your email',
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
                    MaterialPageRoute(builder: (context) => LoginPage()),
                  );
                },
                style: TextButton.styleFrom(
                  overlayColor: Colors.transparent,
                  splashFactory: NoSplash.splashFactory,
                ),
                child: Text(
                  'Go back to login',
                  style: myNoInfoStyle(
                    context,
                  ).copyWith(color: Colors.lightBlueAccent),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
