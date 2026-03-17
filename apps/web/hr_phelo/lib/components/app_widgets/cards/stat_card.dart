import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/app_theme/padding.dart';
import 'package:hr_phelo/Components/app_theme/text_styles.dart';
import 'package:unicons/unicons.dart';

class StatCard extends StatelessWidget {
  const StatCard({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.of(context);
    return Card(
      child: Padding(
        padding: myContentPadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              title: Text('total employees', style: myMainTextStyle(context)),
              trailing: Card.outlined(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                  side: BorderSide(width: 1, color: colorScheme.surface),
                ),
                color: colorScheme.surfaceContainer,
                child: Padding(
                  padding: myContentPadding,
                  child: Icon(
                    UniconsLine.users_alt,
                    size: 30,
                    color: colorScheme.primary,
                  ),
                ),
              ),
            ),
            Flexible(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Text('20', style: myTitleTextStyle(context)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
