import 'package:flutter/material.dart';
import '../../app_theme/misc.dart';
import '../../app_theme/padding.dart';
import '../../app_theme/text_styles.dart';

class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color accentColor;

  const StatCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card.outlined(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(appRadius),
        side: BorderSide(width: 1, color: accentColor.withAlpha(20)),
      ),
      child: Padding(
        padding: myContentPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              title: Text(
                value,
                style: myLargeTextStyle(
                  context,
                ).copyWith(fontWeight: FontWeight.w700),
              ),
              trailing: Icon(
                icon,
                size: 32,
                color: ColorScheme.of(context).onSurface,
              ),
            ),

            Padding(
              padding: myContentPadding,
              child: Text(
                title,
                style: myNoInfoStyle(
                  context,
                ).copyWith(color: ColorScheme.of(context).onSurface),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
