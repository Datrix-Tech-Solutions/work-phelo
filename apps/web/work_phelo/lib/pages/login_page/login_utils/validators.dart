import 'package:email_validator/email_validator.dart';

// Basic (login/reset)
String? Function(String?) basicPasswordValidator() {
  return (String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  };
}

// Strict (registration)
String? Function(String?) strictPasswordValidator() {
  return (String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!RegExp(r'[A-Z]').hasMatch(value)) return 'Must contain at least one uppercase letter';
    if (!RegExp(r'[0-9]').hasMatch(value)) return 'Must contain at least one number';
    if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(value)) {
      return 'Must contain at least one special character';
    }
    return null;
  };
}

// Confirm password (used in registration & reset password)
String? Function(String?) confirmPasswordValidator(String password) {
  return (String? value) {
    if (value == null || value.isEmpty) {
      return 'Please confirm your password';
    }
    if (value != password) {
      return 'Passwords do not match';
    }
    return null;
  };
}

class PasswordStrength {
  final String password;
  final String confirmation;

  PasswordStrength({
    required this.password,
    required this.confirmation,
  });

  bool get hasMinLength => password.length >= 8;
  bool get hasUppercase => RegExp(r'[A-Z]').hasMatch(password);
  bool get hasNumber => RegExp(r'[0-9]').hasMatch(password);
  bool get hasSpecialChar => RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password);

  bool get isStrong => hasMinLength && hasUppercase && hasNumber && hasSpecialChar;

  bool get passwordsMatch => password == confirmation && confirmation.isNotEmpty;

  List<(String requirement, bool met)> get requirements => [
        ('8+ characters', hasMinLength),
        ('Uppercase letter', hasUppercase),
        ('Number', hasNumber),
        ('Special character', hasSpecialChar),
      ];
}

String? emailValidator(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'Email is required';
  }
  if (!EmailValidator.validate(value.trim())) {
    return 'Please enter a valid email';
  }
  return null;
}