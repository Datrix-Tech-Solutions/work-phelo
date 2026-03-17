import 'package:flutter/material.dart';

import '../../Components/app_theme/padding.dart';

class UserAvators extends StatelessWidget {
  const UserAvators({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.of(context);
    return Card.outlined(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(width: 1, color: colorScheme.outline),
      ),
      color: colorScheme.surface,
      child: Padding(padding: myContentPadding, child: Text('DA')),
    );
  }
}
