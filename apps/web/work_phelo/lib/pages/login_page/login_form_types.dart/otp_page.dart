import 'package:flutter/material.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';
import '../../../Components/Form_Components/text_fields.dart';
import '../../../Components/app_theme/text_styles.dart';
import '../../../components/app_theme/app_images.dart';
import '../../../components/app_theme/padding.dart';
import '../../../components/app_widgets/snack_bar.dart';
import '../../../components/form_components/my_buttons.dart';
import '../auth_layout.dart';
import 'login_page.dart';
import 'reset_password.dart';

class OTPPage extends StatefulWidget {
  final String email;
  final String role;
  final String fullName;
  final String companyName;
  const OTPPage({
    super.key,
    required this.email,
    required this.role,
    required this.fullName,
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
      final user = AppUser(
        uid: "mock_${widget.email.trim().toLowerCase().hashCode}",
        email: widget.email,
        fullName: widget.fullName,
        role: widget.role,
        companyName: widget.companyName,
        lastLogin: DateTime.now(),
        tenantSlug: '',
        companyStatus: '',
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
            appImage,
            Text('Verify', style: myLargeTextStyle(context)),
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
            Padding(padding: space),
            MySecButton(
              btnText: 'go back to login',
              btnOnPressed: () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginPage()),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

//RESET PASSWORD CODE PAGE

class ResetPasswordCodePage extends StatefulWidget {
  final String email;
  final String role;
  final String fullName;
  final String companyName;
  const ResetPasswordCodePage({
    super.key,
    required this.email,
    required this.role,
    required this.fullName,
    required this.companyName,
  });

  @override
  State<ResetPasswordCodePage> createState() => _ResetPasswordCodePageState();
}

class _ResetPasswordCodePageState extends State<ResetPasswordCodePage> {
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
      navigator.pushReplacement(
        MaterialPageRoute(builder: (context) => ResetPassword()),
      );
    } else {
      _otpController.clear();
      _showMessage("Invalid reset code", isSuccess: false);
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
            appImage,
            Text('Verify', style: myLargeTextStyle(context)),
            Padding(padding: space),
            Text(
              'We have a sent a password reset code\nto your email',
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
