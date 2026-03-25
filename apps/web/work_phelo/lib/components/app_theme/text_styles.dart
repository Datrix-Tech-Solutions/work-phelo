import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

TextStyle appFont(TextStyle? base) => GoogleFonts.figtree(textStyle: base);

TextStyle myMainTextStyle(BuildContext context) =>
    appFont(Theme.of(context).textTheme.bodyMedium).copyWith(
      color: Theme.of(context).colorScheme.onSurface,
      fontWeight: FontWeight.w400,
    );

TextStyle myTitleTextStyle(BuildContext context) =>
    appFont(Theme.of(context).textTheme.titleLarge).copyWith(
      color: Theme.of(context).colorScheme.onSurface,
      fontWeight: FontWeight.w600,
    );

TextStyle myTextFieldStyle(BuildContext context) =>
    appFont(Theme.of(context).textTheme.bodyMedium).copyWith(
      color: Theme.of(context).colorScheme.outline,
      fontWeight: FontWeight.w100,
    );

TextStyle myNoInfoStyle(BuildContext context) =>
    appFont(Theme.of(context).textTheme.bodySmall).copyWith(
      color: Theme.of(context).colorScheme.outline,
      fontWeight: FontWeight.w500,
    );

TextStyle myLargeTextStyle(BuildContext context) =>
    appFont(Theme.of(context).textTheme.headlineLarge).copyWith(
      color: Theme.of(context).colorScheme.onSurface,
      fontWeight: FontWeight.w500,
    );

TextStyle myDisplayTextStyle(BuildContext context) =>
    appFont(Theme.of(context).textTheme.bodyLarge).copyWith(
      color: Theme.of(context).colorScheme.onSurface,
      fontWeight: FontWeight.w900,
    );
