import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../work_phelo_components/widgets/misc/snack_bar.dart';
import '../auth_layout.dart';
import '../login_utils/validators.dart';

class SuperAdminLoginPage extends ConsumerStatefulWidget {
  const SuperAdminLoginPage({super.key});

  @override
  ConsumerState<SuperAdminLoginPage> createState() =>
      _SuperAdminLoginPageState();
}

class _SuperAdminLoginPageState extends ConsumerState<SuperAdminLoginPage> {
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

    await ref
        .read(authNotifierProvider.notifier)
        .loginSuperAdmin(email: email, password: password);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthenticationState>(authNotifierProvider, (previous, next) {
      if (next.error != null) {
        setState(() {
          _errorMessage = next.error;
          showLoginState = true;
        });
      } else if (previous?.isAuthenticated == false &&
          next.isAuthenticated &&
          next.user != null) {
        setState(() => showLoginState = false);
        if (next.user!.isSuperAdmin) {
          context.go('/platform/dashboard');
        }
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
            Text('Super Admin Login', style: myTitleTextStyle(context)),
            Padding(padding: space),

            MyCustomTextField(
              label: 'Email',
              placeholder: 'Enter super admin email',
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

            Padding(padding: space),

            MyButton(
              btnText: 'Sign in as Super Admin',
              loadingText: 'Signing in...',
              isLoading: isLoading,
              btnOnPressed: _handleLogin,
            ),
          ],
        ),
      ),
    );
  }
}
