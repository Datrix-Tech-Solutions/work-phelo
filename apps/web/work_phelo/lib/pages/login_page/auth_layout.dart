import 'package:flutter/material.dart';

import '../../work_phelo_components/theme/app_images.dart';
import '../../work_phelo_components/theme/app_text_theme.dart';

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
          Expanded(
            flex: 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Background image
                loginPageImage,

                // Color overlay
                Container(
                  color: ColorScheme.of(context).primary.withAlpha(100),
                ),

                // Text on top
                Align(
                  alignment: Alignment.bottomLeft,
                  child: Padding(
                    padding: EdgeInsets.only(left: 80, bottom: 100),
                    child: ListTile(
                      title: Text(
                        "EMPOWER YOUR ORGANIZATION",
                        style: myLargeTextStyle(context).copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      subtitle: Text(
                        "WorkPhelo HR helps organizations manage employees, streamline HR processes, and build productive teams — all from one unified platform.",
                        style: myTitleTextStyle(
                          context,
                        ).copyWith(color: Colors.white70, fontSize: 16),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
