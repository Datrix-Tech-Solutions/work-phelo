import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../work_phelo_components/theme/app.colors.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../work_phelo_components/widgets/misc/snack_bar.dart';
import '../auth_layout.dart';
import '../login_utils/validators.dart';
import 'forgot_password.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  bool isLoading = false;
  bool showLoginState = false;
  String? _errorMessage;

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter your email and password.';
        showLoginState = true;
      });
      return;
    }

    setState(() => showLoginState = false);

    await ref.read(authNotifierProvider.notifier).login(email, password);
  }

  void _routeToDashboard(AppUserModel user) {
    // Pending platform owner → get started flow
    if (user.isPlatformOwner) {
      final companies = ref.read(companyProvider).companies;
      final company = companies.cast<CompanyModel?>().firstWhere(
        (c) => c?.tenantSlug == user.tenantSlug,
        orElse: () => null,
      );

      if (company?.status == CompanyStatus.pending) {
        Navigator.pushNamedAndRemoveUntil(
          context,
          '/get-started',
          (route) => false,
          arguments: user,
        );
        return;
      }
    }

    // Normal routing
    final String route = switch (user.role) {
      'super_admin' => '/platform/dashboard',
      'platform_owner' => '/dashboard',
      _ => '/home',
    };

    Navigator.pushNamedAndRemoveUntil(
      context,
      route,
      (route) => false,
      arguments: user,
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthenticationState>(authNotifierProvider, (previous, next) {
      if (next.error != null) {
        setState(() => _errorMessage = next.error);
        showLoginState = true;
      }
      if (next.isAuthenticated && next.user != null) {
        _routeToDashboard(next.user!);
      }
    });

    final isLoading = ref.watch(authNotifierProvider).isLoading;
    return AuthLayout(
      stateBanner: showLoginState
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
              controller: _emailController,
              validator: emailValidator,
              keyType: TextInputType.emailAddress,
              textAction: TextInputAction.next,
            ),

            MyPasswordField(
              label: 'Password',
              placeholder: 'Enter your password',
              controller: _passwordController,
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
