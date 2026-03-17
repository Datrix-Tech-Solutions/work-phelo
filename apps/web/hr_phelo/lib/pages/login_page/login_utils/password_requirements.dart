import 'package:flutter/material.dart';
import 'package:hr_phelo/components/app_theme/text_styles.dart';

class PasswordRequirement extends StatelessWidget {
  final String text;
  final bool met;

  const PasswordRequirement({super.key, required this.text, required this.met});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(
          met ? Icons.check_circle : Icons.radio_button_unchecked,
          color: met ? Colors.green : colorScheme.outline,
          size: 18,
        ),
        const SizedBox(width: 8),
        Text(
          text,
          style: myMainTextStyle(
            context,
          ).copyWith(color: colorScheme.outline, fontSize: 13),
        ),
      ],
    );
  }
}
