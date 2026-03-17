import 'package:flutter/material.dart';

const myMainColor = Color(0xFF03294E);

final ThemeData lightTheme = ThemeData(
  useMaterial3: true,
  visualDensity: VisualDensity.comfortable,
  colorScheme: myLightColorScheme,

  scaffoldBackgroundColor: Colors.white,

  appBarTheme: AppBarTheme(
    backgroundColor: myMainColor,
    foregroundColor: Colors.white,
    elevation: 0,
    centerTitle: true,
  ),

  floatingActionButtonTheme: FloatingActionButtonThemeData(
    backgroundColor: myMainColor,
    foregroundColor: Colors.white,
  ),

  snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating),

  textTheme: TextTheme(
    titleLarge: TextStyle(fontWeight: FontWeight.bold),
    bodyMedium: TextStyle(fontSize: 16),
  ),
);

final ThemeData darkTheme = ThemeData(
  useMaterial3: true,
  visualDensity: VisualDensity.comfortable,

  colorScheme: myDarkColorScheme,

  scaffoldBackgroundColor: const Color(0xFF121212),

  appBarTheme: AppBarTheme(
    backgroundColor: const Color(0xFF1E1E1E),
    foregroundColor: Colors.white,
    elevation: 0,
    centerTitle: true,
  ),

  floatingActionButtonTheme: FloatingActionButtonThemeData(
    backgroundColor: myMainColor,
    foregroundColor: Colors.white,
  ),

  snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),

  textTheme: const TextTheme(
    titleLarge: TextStyle(fontWeight: FontWeight.bold),
    bodyMedium: TextStyle(fontSize: 16),
  ),
);

//MY LIGHT COLOR SCHERME
const ColorScheme myLightColorScheme = ColorScheme(
  brightness: Brightness.light,

  primary: myMainColor,
  onPrimary: Colors.white,

  secondary: Color(0xFF2E5E8C),
  onSecondary: Colors.white,

  error: Colors.red,
  onError: Colors.white,

  surface: Color(0xFFFFFFFF),
  onSurface: Color(0xFF1A1A1A),

  surfaceContainer: Color(0xFFFAFAFA),
  onSurfaceVariant: Color(0xFF4A5568),

  outline: Color(0xFFD0D7DE),

  tertiary: Color(0xFF4A90E2),
  onTertiary: Colors.white,
);

//MY DARK COLOR SCHEME
const ColorScheme myDarkColorScheme = ColorScheme(
  brightness: Brightness.dark,

  primary: myMainColor,
  onPrimary: Colors.white,

  secondary: Color(0xFF4A90E2),
  onSecondary: Colors.white,

  error: Colors.redAccent,
  onError: Colors.black,

  surface: Color(0xFF1E1E1E),
  onSurface: Colors.white,

  surfaceContainer: Color(0xFF2A2A2A),
  onSurfaceVariant: Color(0xFFB0B0B0),

  outline: Color(0xFF3A3A3A),

  tertiary: Color(0xFF6CA6FF),
  onTertiary: Colors.black,
);
