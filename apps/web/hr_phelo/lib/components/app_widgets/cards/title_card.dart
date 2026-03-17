import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/App_Theme/colors.dart';
import 'package:hr_phelo/components/app_theme/padding.dart';
import 'package:hr_phelo/components/app_theme/text_styles.dart';

class TitleCard extends StatefulWidget {
  final String companyName;
  final String introText;
  final String? statTitle1;
  final String? stat1;
  final String? statTitle2;
  final String? stat2;
  final String? statTitle3;
  final String? stat3;
  final String? statTitle4;
  final String? stat4;
  const TitleCard({
    super.key,
    required this.introText,
    required this.companyName,
    this.statTitle1,
    this.stat1,
    this.statTitle2,
    this.stat2,
    this.statTitle3,
    this.stat3,
    this.statTitle4,
    this.stat4,
  });

  @override
  State<TitleCard> createState() => _TitleCardState();
}

class _TitleCardState extends State<TitleCard> {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: menuItemPadding,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [myMainColor, Colors.blue],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 3,
              child: ListTile(
                title: Text(
                  widget.companyName,
                  style: myMainTextStyle(
                    context,
                  ).copyWith(color: Colors.amber[900]),
                ),
                subtitle: Text(
                  widget.introText,
                  style: myLargeTextStyle(
                    context,
                  ).copyWith(color: ColorScheme.of(context).surface),
                ),
              ),
            ),
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: ListTile(
                      title: Text(
                        widget.statTitle1 ?? '',
                        style: myNoInfoStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                      subtitle: Text(
                        widget.stat1 ?? '',
                        style: myMainTextStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                    ),
                  ),
                  Flexible(
                    child: ListTile(
                      title: Text(
                        widget.statTitle2 ?? '',
                        style: myNoInfoStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                      subtitle: Text(
                        widget.stat2 ?? '',
                        style: myMainTextStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                    ),
                  ),
                  Flexible(
                    child: ListTile(
                      title: Text(
                        widget.statTitle3 ?? '',
                        style: myNoInfoStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                      subtitle: Text(
                        widget.stat3 ?? '',
                        style: myMainTextStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                    ),
                  ),
                  Flexible(
                    child: ListTile(
                      title: Text(
                        widget.statTitle4 ?? '',
                        style: myNoInfoStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                      subtitle: Text(
                        widget.stat4 ?? '',
                        style: myMainTextStyle(
                          context,
                        ).copyWith(color: ColorScheme.of(context).surface),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WelcomeCard extends StatefulWidget {
  final String date;
  final String welcomeText;

  const WelcomeCard({super.key, required this.welcomeText, required this.date});

  @override
  State<WelcomeCard> createState() => _WelcomeCardState();
}

class _WelcomeCardState extends State<WelcomeCard> {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: menuItemPadding,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [myMainColor, Colors.blue],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 3,
              child: ListTile(
                title: Text(
                  widget.welcomeText,
                  style: myLargeTextStyle(
                    context,
                  ).copyWith(color: ColorScheme.of(context).surface),
                ),
                subtitle: Text(
                  widget.date,
                  style: myMainTextStyle(
                    context,
                  ).copyWith(color: Colors.amber[500]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WelcomeCardAlt extends StatefulWidget {
  final String details;
  final String title;

  const WelcomeCardAlt({super.key, required this.title, required this.details});

  @override
  State<WelcomeCardAlt> createState() => _WelcomeCardAltState();
}

class _WelcomeCardAltState extends State<WelcomeCardAlt> {
  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.of(context);
    return Padding(
      padding: menuItemPadding,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [colorScheme.surfaceContainer, colorScheme.surface],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 3,
              child: ListTile(
                title: Text(
                  widget.title,
                  style: myLargeTextStyle(
                    context,
                  ).copyWith(color: ColorScheme.of(context).onSurface),
                ),
                subtitle: Text(widget.details, style: myMainTextStyle(context)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
