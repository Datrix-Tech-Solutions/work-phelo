import 'package:flutter/material.dart';

import 'dart:math' show Random;

import '../app_theme/text_styles.dart';


class UserAvatar extends StatelessWidget {
  final String initials;
  final double size;
  final bool withShadow;

  const UserAvatar({
    super.key,
    required this.initials,
    this.size = 48.0,
    this.withShadow = true,
  });

  Color _getBackgroundColor(String text) {
    final hash = text.hashCode;
    final random = Random(hash);
    final hue = random.nextInt(360);
    return HSLColor.fromAHSL(1.0, hue.toDouble(), 0.45, 0.65).toColor();
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = _getBackgroundColor(initials);
    final textColor = _getContrastingColor(bgColor);

    return Container(
      width: size,
      height: size,
      decoration: withShadow
          ? BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(8),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            )
          : null,
      child: CircleAvatar(
        radius: size / 2,
        backgroundColor: bgColor,
        child: Text(
          initials.toUpperCase(),
          style: myMainTextStyle(context).copyWith(
            color: textColor ?? Colors.white,
            fontSize: size * 0.44,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
      ),
    );
  }

  Color? _getContrastingColor(Color bg) {
    final luminance = bg.computeLuminance();
    return luminance > 0.55 ? Colors.black87 : Colors.white;
  }
}

class UserDashIcon extends StatelessWidget {
  final String initials;
  final GestureTapDownCallback onIconPressed;
  final double size;
  final bool withShadow;

  const UserDashIcon({
    super.key,
    required this.onIconPressed,
    required this.initials,
    this.size = 16.0,
    this.withShadow = true,
  });

  Color _getBackgroundColor(String text) {
    final hash = text.hashCode;
    final random = Random(hash);
    final hue = random.nextInt(360);
    return HSLColor.fromAHSL(1.0, hue.toDouble(), 0.45, 0.65).toColor();
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = _getBackgroundColor(initials);
    final textColor = _getContrastingColor(bgColor);

    return InkWell(
      hoverColor: Colors.transparent,
      splashColor: Colors.transparent,
      onTapDown: onIconPressed,
      child: CircleAvatar(
        radius: size,
        backgroundColor: bgColor,
        child: Text(
          initials.toUpperCase(),
          style: myMainTextStyle(context).copyWith(
            color: textColor ?? Colors.white,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
      ),
    );
  }

  Color? _getContrastingColor(Color bg) {
    final luminance = bg.computeLuminance();
    return luminance > 0.55 ? Colors.black87 : Colors.white;
  }
}
