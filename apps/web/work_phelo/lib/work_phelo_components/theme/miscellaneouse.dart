import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_components/theme/app_padding.dart';

import 'app.colors.dart';
import 'app_text_theme.dart';

Divider myDivider(BuildContext context) => Divider(
  thickness: 1,
  indent: 5,
  endIndent: 5,
  height: 5,
  color: ColorScheme.of(context).outline,
);

final double appRadius = 8;

final List<String> gender = ['Male', 'Female'];

final List<String> maritalStatus = ['Single', 'Married', 'Divorced'];

final List<String> months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

class ScreenCheck {
  static bool isDesktop(BuildContext context) {
    return _getDeviceWidth(context) > 1024;
  }

  static bool isMobile(BuildContext context) {
    return _getDeviceWidth(context) <= 600;
  }

  static double _getDeviceWidth(BuildContext context) {
    return MediaQuery.of(context).size.width;
  }
}

InputDecoration appTextFieldDecoration(
  BuildContext context, {
  String? hintText,
  String? prefixText,
  TextStyle? hintStyle,
  TextStyle? labelStyle,
  IconData? suffixIcon,
  bool obscureText = false,
  VoidCallback? onToggleVisibility,
  bool showVisibilityToggle = true,
  bool showPrefixIcon = false,
  IconData? prefixIconData,
  Color? prefixIconColor,
}) {
  final cs = Theme.of(context).colorScheme;

  return InputDecoration(
    contentPadding: EdgeInsets.only(left: 10, right: 10),
    counterText: '',
    prefixText: prefixText,
    hintText: hintText,
    labelStyle: labelStyle,
    prefixIcon: showPrefixIcon && prefixIconData != null
        ? Icon(
            prefixIconData,
            color: prefixIconColor ?? cs.onSurfaceVariant,
            size: 20,
          )
        : null,
    hintStyle: hintStyle ?? myTextFieldStyle(context),
    suffixIcon: showVisibilityToggle && onToggleVisibility != null
        ? IconButton(
            hoverColor: Colors.transparent,
            highlightColor: Colors.transparent,
            icon: Icon(
              obscureText ? UniconsLine.eye_slash : UniconsLine.eye,
              color: cs.onSurfaceVariant,
              size: 20,
            ),
            onPressed: onToggleVisibility,
            tooltip: obscureText ? 'Show password' : 'Hide password',
          )
        : null,

    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(appRadius),
      borderSide: BorderSide(color: cs.outline),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(appRadius),
      borderSide: BorderSide(color: cs.primary.withAlpha(70), width: 1),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(appRadius),
      borderSide: BorderSide(color: myMainColor.withAlpha(70), width: 2),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(appRadius),
      borderSide: const BorderSide(color: Colors.red, width: 1),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(appRadius),
      borderSide: const BorderSide(color: Colors.redAccent, width: 2),
    ),
  );
}


Widget sectionHeader(BuildContext context, String title) {
  return Padding(
    padding: formWidgetPadding,
    child: Text(
      title.toUpperCase(),
      style: myMainTextStyle(context).copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.1,
        color: Theme.of(context).colorScheme.onSurface,
      ),
    ),
  );
}


Widget titleHeader(BuildContext context, String title) {
  return Padding(
    padding: formWidgetPadding,
    child: Text(
      title.toUpperCase(),
      style: myTitleTextStyle(context).copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: 1.5,
        color: Theme.of(context).colorScheme.onSurface,
      ),
    ),
  );
}