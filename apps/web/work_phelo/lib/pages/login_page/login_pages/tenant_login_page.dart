
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
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
import '../login_form_types.dart/forgot_password.dart';

class TenantLoginPage extends ConsumerStatefulWidget {
  final String tenantSlug;
  const TenantLoginPage({super.key, this.tenantSlug = ''});

  @override
  ConsumerState<TenantLoginPage> createState() => _TenantLoginPageState();
}

class _TenantLoginPageState extends ConsumerState<TenantLoginPage> {
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
    if (widget.tenantSlug.isEmpty) {
      setState(() {
        _errorMessage =
            'Invalid login link. Please use the link from your onboarding email.';
        showLoginState = true;
      });
      return;
    }
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

    await ref
        .read(authNotifierProvider.notifier)
        .loginTenant(
          tenantSlug: widget.tenantSlug,
          email: email,
          password: password,
        );
  }

  void _routeToDashboard(AppUserModel user) {
    if (user.isPlatformOwner && user.companyStatus == 'pending') {
      context.go('/get-started', extra: user);
      return;
    }

    final String route = switch (user.role) {
      'TENANT_ADMIN' => '/tenant/dashboard',
      _ => '/dashboard',
    };

    context.go(route);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthenticationState>(authNotifierProvider, (previous, next) {
  // ── Clear error when loading starts ──
  if (next.isLoading) {
    setState(() => showLoginState = false);
    return;
  }

  if (next.error != null) {
    setState(() {
      _errorMessage = next.error;
      showLoginState = true;
    });
    return;
  }

  if (previous?.isAuthenticated == false &&
      next.isAuthenticated &&
      next.user != null) {
    setState(() => showLoginState = false);
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
            loginImage,
            Padding(padding: space),
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
                      builder: (_) => const EmailConfirmationForReset(),
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

            Padding(padding: space),

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
