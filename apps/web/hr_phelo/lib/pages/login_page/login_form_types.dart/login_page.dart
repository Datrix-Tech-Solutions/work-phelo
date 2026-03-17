import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/app_theme/colors.dart';
import 'package:hr_phelo/components/App_Theme/misc.dart';
import 'package:hr_phelo/components/app_theme/app_images.dart';
import 'package:hr_phelo/components/app_theme/padding.dart';
import 'package:hr_phelo/components/app_widgets/snack_bar.dart';
import 'package:hr_phelo/pages/login_page/auth_layout.dart';
import 'package:hr_phelo/pages/login_page/login_form_types.dart/forgot_password.dart';
import 'package:hr_phelo/pages/login_page/login_form_types.dart/otp_page.dart';
import 'package:unicons/unicons.dart';

import '../../../Components/Form_Components/text_fields.dart';
import '../../../Components/app_theme/text_styles.dart';
import '../../../components/form_components/my_buttons.dart';
import '../login_utils/mock_user.dart';
import '../login_utils/validators.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  bool isLoading = false;
  bool _showLoginState = false;
  String? _errorMessage;

  final _formKey = GlobalKey<FormState>();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      isLoading = true;
      _showLoginState = false;
      _errorMessage = null;
    });

    try {
      final result = await MockAuthService.login(
        email: emailController.text,
        password: passwordController.text,
      );

      if (result == null) {
        throw Exception("Incorrect email or password");
      }

      debugPrint("Login success → ${result['fullName']} (${result['role']})");

      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => OTPPage(
            fullName: result['fullName'] as String,
            email: result['email'] as String,
            role: result['role'] as String,
            companyName: result['companyName'] as String,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _showLoginState = true;
        _errorMessage = e.toString().replaceAll('Exception: ', '').trim();
        if (_errorMessage == null || _errorMessage!.isEmpty) {
          _errorMessage = "Something went wrong. Please try again.";
        }

        Future.delayed(const Duration(seconds: 5), () {
          if (mounted) {
            setState(() => _showLoginState = false);
          }
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
    return AuthLayout(
      stateBanner: _showLoginState
          ? MySnackBar(
              snackMessage: _errorMessage ?? "An error occurred",
              snackIcon: UniconsLine.times_circle,
              snackColor: Colors.red,
            )
          : null,
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            appImage,
            Text('Sign in', style: myTitleTextStyle(context)),
            Padding(padding: space),

            MyCustomTextField(
              label: 'Email',
              placeholder: 'Enter your organization assigned email',
              controller: emailController,
              validator: emailValidator,
              keyType: TextInputType.emailAddress,
              textAction: TextInputAction.next,
            ),

            MyPasswordField(
              label: 'Password',
              placeholder: 'Enter your password',
              controller: passwordController,
              validator: basicPasswordValidator(),
              textAction: TextInputAction.done,
            ),

            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const EmailConfirmation(),
                    ),
                  );
                },
                style: TextButton.styleFrom(
                  overlayColor: Colors.transparent,
                  splashFactory: NoSplash.splashFactory,
                ),
                child: Text(
                  'Forgot your Password?',
                  style: myMainTextStyle(context).copyWith(color: myMainColor),
                ),
              ),
            ),

            MyButton(
              btnText: 'Sign in',
              loadingText: 'Signing in...',
              isLoading: isLoading,
              btnOnPressed: _handleLogin,
            ),

            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(child: myDivider(context)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text('Sign in with', style: myMainTextStyle(context)),
                ),
                Flexible(child: myDivider(context)),
              ],
            ),

            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: WidgetButton(
                    btnIcon: UniconsLine.google,
                    btnText: 'Google',
                    btnPressed: () {},
                  ),
                ),
                const SizedBox(width: 16),
                Flexible(
                  child: WidgetButton(
                    btnIcon: UniconsLine.windows,
                    btnText: 'Microsoft',
                    btnPressed: () {},
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
