import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'routings/go_routes.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'work_phelo_components/theme/app.colors.dart';

void main() {
  usePathUrlStrategy();
  runApp(ProviderScope(child: const MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      routerConfig: router,
      title: 'Work Phelo',
      debugShowCheckedModeBanner: false,
      theme: lightTheme,
      // theme: darkTheme,
    );
  }
}
