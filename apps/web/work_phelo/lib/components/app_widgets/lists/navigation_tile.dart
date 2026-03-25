import 'package:flutter/material.dart';

import '../../app_theme/misc.dart';
import '../../app_theme/text_styles.dart';
import 'navigation.dart';

Widget navigationTile({
  required BuildContext context,
  required NavDestination destination,
  required bool isSelected,
  required VoidCallback onTap,
  bool showLabel = true,
  bool isCompact = false,
}) {
  final cs = Theme.of(context).colorScheme;
  final accent = cs.primary;

  return AnimatedContainer(
    duration: const Duration(milliseconds: 200),
    curve: Curves.easeInOut,
    margin: EdgeInsets.symmetric(horizontal: 8, vertical: 1),
    decoration: BoxDecoration(
      color: isSelected ? accent.withAlpha(20) : Colors.transparent,
      borderRadius: BorderRadius.circular(appRadius),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(appRadius),
      onTap: onTap,
      hoverColor: accent.withAlpha(10),
      splashColor: accent.withAlpha(20),
      highlightColor: Colors.transparent,
      child: Stack(
        alignment: Alignment.centerLeft,
        children: [
          // ── Indicator bar ─────────────────────────────────
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            width: isSelected ? 3 : 0,
            height: 20,
            decoration: BoxDecoration(
              color: accent,
              borderRadius: BorderRadius.only(
                topRight: Radius.circular(3),
                bottomRight: Radius.circular(3),
              ),
            ),
          ),
          // ── Content ───────────────────────────────────────
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: isCompact ? 10 : 16,
              vertical: isCompact ? 10 : 11,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  destination.icon,
                  size: 20,
                  color: isSelected ? accent : cs.onSurfaceVariant,
                ),
                if (showLabel) ...[
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      destination.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: myMainTextStyle(context).copyWith(
                        fontSize: 14,
                        fontWeight: isSelected
                            ? FontWeight.w600
                            : FontWeight.w400,
                        color: isSelected ? accent : cs.onSurface,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
