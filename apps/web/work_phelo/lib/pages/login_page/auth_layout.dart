import 'package:flutter/material.dart';

import '../../components/app_theme/colors.dart';

class AuthLayout extends StatelessWidget {
  final Widget child;
  final Widget? stateBanner;
  const AuthLayout({super.key, required this.child, this.stateBanner});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ColorScheme.of(context).surfaceContainer,
      body: Row(
        children: [
          /// form area
          Expanded(
            flex: 2,
            child: Stack(
              children: [
                Center(
                  child: SingleChildScrollView(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: 500),
                      child: Card(
                        color: ColorScheme.of(context).surface,
                        elevation: 0,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 40,
                            vertical: 40,
                          ),
                          child: child,
                        ),
                      ),
                    ),
                  ),
                ),
                if (stateBanner != null)
                  Positioned(top: 16, left: 50, right: 50, child: stateBanner!),
              ],
            ),
          ),
          // image area
          Expanded(flex: 3, child: Container(color: myMainColor)),
        ],
      ),
    );
  }
}
