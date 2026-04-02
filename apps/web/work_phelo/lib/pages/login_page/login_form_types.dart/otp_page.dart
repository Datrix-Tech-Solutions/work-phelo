import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../work_phelo_funtions/work_phelo_login_functions/authentication_service.dart';
import 'package:work_phelo/pages/login_page/get_started/set_password_page.dart';
import 'package:work_phelo/work_phelo_components/theme/miscellaneouse.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/app_text_fields.dart';
import '../../../work_phelo_components/widgets/misc/snack_bar.dart';
import '../auth_layout.dart';
import 'reset_password.dart';

class OTPPage extends StatefulWidget {
  final String email;
  final String role;
  final String firstName;
  final String lastName;
  final String companyName;
  const OTPPage({
    super.key,
    required this.email,
    required this.role,
    required this.firstName,
    required this.lastName,
    required this.companyName,
  });

  @override
  State<OTPPage> createState() => _OTPPageState();
}

class _OTPPageState extends State<OTPPage> {
  late final TextEditingController _otpController;
  bool isVerifying = false;
  bool _showBanner = false;
  bool _isSuccess = false;
  String? _bannerMessage;

  final String _mockCorrectOtp = '123456';

  @override
  void initState() {
    super.initState();
    _otpController = TextEditingController();
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  void _showMessage(String message, {required bool isSuccess}) {
    setState(() {
      _showBanner = true;
      _isSuccess = isSuccess;
      _bannerMessage = message;
    });

    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() => _showBanner = false);
      }
    });
  }

  void _clearMessage() {
    if (mounted) {
      setState(() => _showBanner = false);
    }
  }

  Future<void> _verifyOtp(String otp) async {
    if (otp.length != 6 || isVerifying) return;

    final navigator = Navigator.of(context);

    setState(() {
      isVerifying = true;
      _clearMessage();
    });

    await Future.delayed(const Duration(seconds: 3));

    if (!mounted) return;

    if (otp == _mockCorrectOtp) {
      String routeName;
      final user = AppUserModel(
        uid: "mock_${widget.email.trim().toLowerCase().hashCode}",
        email: widget.email,
        firstName: widget.firstName,
        lastName: widget.lastName,
        role: widget.role,
        companyName: widget.companyName,
        lastLogin: DateTime.now(),
        tenantSlug: '',
        companyStatus: '',
        tenantId: '',
      );

      switch (widget.role.toLowerCase()) {
        case 'super_admin':
          routeName = '/platform/dashboard';
          break;

        case 'platform_owner':
          routeName = '/dashboard';

        default:
          routeName = '/home';
      }

      navigator.pushReplacementNamed(routeName, arguments: user);
    } else {
      _otpController.clear();
      _showMessage("Invalid verification code", isSuccess: false);
    }

    setState(() => isVerifying = false);
  }

  Future<void> _resendOtp() async {
    if (isVerifying) return;

    await Future.delayed(const Duration(seconds: 3));

    if (!mounted) return;

    _otpController.clear();
    _showMessage(
      "A new code has been sent to ${widget.email}",
      isSuccess: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      stateBanner: _showBanner
          ? MySnackBar(
              snackMessage: _bannerMessage ?? "Operation completed",
              type: _isSuccess ? SnackBarType.success : SnackBarType.error,
            )
          : null,
      child: Form(
        child: Column(
          children: [
            loginImage,
            Padding(padding: space),
            sectionHeader(context, 'Veryfy email'),
            Padding(padding: space),
            Text(
              'We have a sent a verification code\nto your email',
              textAlign: TextAlign.center,
              style: myMainTextStyle(context).copyWith(
                fontWeight: FontWeight.normal,
                color: ColorScheme.of(context).outline,
              ),
            ),
            SizedBox(height: 16),
            OtpTextBoxes(
              length: 6,
              controller: _otpController,
              onCompleted: _verifyOtp,
            ),
            Padding(padding: space),
            MyButton(
              btnText: 'Verify',
              loadingText: 'Verifying...',
              isLoading: isVerifying,
              btnOnPressed: () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const SetPasswordPage(tenantSlug: ''),
                  ),
                );
              },
            ),
            if (!isVerifying)
              MyTextButton(
                txtBtnText: 'Resend code',
                txtBtnOnPressed: _resendOtp,
              ),
            Padding(padding: space),
          ],
        ),
      ),
    );
  }
}

//
//
///
///
///
///
///
///
///
///
///
///
///
//RESET PASSWORD CODE PAGE

class ResetPasswordCodePage extends ConsumerStatefulWidget {
  final String email;
  final String tenantSlug;
  final String role;
  final String fullName;
  final String companyName;

  const ResetPasswordCodePage({
    super.key,
    required this.email,
    this.tenantSlug = '',
    required this.role,
    required this.fullName,
    required this.companyName,
  });

  @override
  ConsumerState<ResetPasswordCodePage> createState() => _ResetPasswordCodePageState();
}

class _ResetPasswordCodePageState extends ConsumerState<ResetPasswordCodePage> {
  late final TextEditingController _otpController;
  bool isVerifying = false;
  bool _showBanner = false;
  bool _isSuccess = false;
  String? _bannerMessage;

  @override
  void initState() {
    super.initState();
    _otpController = TextEditingController();
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  void _showMessage(String message, {required bool isSuccess}) {
    setState(() {
      _showBanner = true;
      _isSuccess = isSuccess;
      _bannerMessage = message;
    });
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) setState(() => _showBanner = false);
    });
  }

  Future<void> _verifyOtp(String otp) async {
    if (otp.length != 6 || isVerifying) return;
    setState(() { isVerifying = true; _showBanner = false; });

    // Don't call the API here — just pass the OTP to SetPasswordPage
    // The actual verification happens when the user submits their new password
    await Future.delayed(const Duration(milliseconds: 300));

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => SetPasswordPage(
            tenantSlug: widget.tenantSlug,
            token: otp,
            isResetFlow: true,
          ),
        ),
      );
    }

    setState(() => isVerifying = false);
  }

  Future<void> _resendOtp() async {
    if (isVerifying) return;
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/auth/forgot-password', data: {
        'email': widget.email,
        'tenantSlug': widget.tenantSlug,
      });
      _otpController.clear();
      _showMessage('A new code has been sent to \${widget.email}', isSuccess: true);
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = data is Map ? data['message']?.toString() ?? 'Failed to resend' : 'Failed to resend';
      _showMessage(msg, isSuccess: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      stateBanner: _showBanner
          ? MySnackBar(
              snackMessage: _bannerMessage ?? 'Operation completed',
              type: _isSuccess ? SnackBarType.success : SnackBarType.error,
            )
          : null,
      child: Form(
        child: Column(
          children: [
            appImage,
            Text('Verify', style: myLargeTextStyle(context)),
            Padding(padding: space),
            Text(
              'We have sent a password reset code to your email',
              textAlign: TextAlign.center,
              style: myMainTextStyle(context).copyWith(
                fontWeight: FontWeight.normal,
                color: ColorScheme.of(context).outline,
              ),
            ),
            const SizedBox(height: 16),
            OtpTextBoxes(
              length: 6,
              controller: _otpController,
              onCompleted: _verifyOtp,
            ),
            MyButton(
              btnText: 'Verify',
              loadingText: 'Verifying...',
              isLoading: isVerifying,
              btnOnPressed: () => _verifyOtp(_otpController.text),
            ),
            if (!isVerifying)
              MyTextButton(
                txtBtnText: 'Resend code',
                txtBtnOnPressed: _resendOtp,
              ),
          ],
        ),
      ),
    );
  }
}
