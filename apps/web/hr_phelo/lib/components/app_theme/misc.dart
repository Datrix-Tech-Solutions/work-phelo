import 'package:flutter/material.dart';

Divider myDivider(BuildContext context) => Divider(
  thickness: 1,
  indent: 5,
  endIndent: 5,
  height: 5,
  color: ColorScheme.of(context).outline,
);

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
