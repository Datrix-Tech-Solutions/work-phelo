import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../app_theme/misc.dart';
import '../app_theme/text_styles.dart';

enum SnackBarType { error, success, info }

class MySnackBar extends StatelessWidget {
  final String snackMessage;
  final IconData? snackIcon;
  final Color? snackColor;
  final SnackBarType type;

  const MySnackBar({
    super.key,
    required this.snackMessage,
    this.snackIcon,
    this.snackColor,
    this.type = SnackBarType.info,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final effectiveColor = snackColor ??
        (type == SnackBarType.error
            ? Colors.red
            : type == SnackBarType.success
                ? Colors.green.shade700
                : theme.colorScheme.primary);

    final effectiveIcon = snackIcon ??
        (type == SnackBarType.error
            ? UniconsLine.times_circle
            : type == SnackBarType.success
                ? UniconsLine.check_circle
                : UniconsLine.info_circle);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: effectiveColor.withAlpha(12),
        borderRadius: BorderRadius.circular(appRadius),
        border: Border.all(color: effectiveColor.withAlpha(40)),
      ),
      child: Row(
        children: [
          Icon(effectiveIcon, color: effectiveColor, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              snackMessage,
              style: myMainTextStyle(context)
            ),
          ),
        ],
      ),
    );
  }
}
