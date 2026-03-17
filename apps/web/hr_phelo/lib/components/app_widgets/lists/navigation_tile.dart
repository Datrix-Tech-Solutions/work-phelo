import 'package:flutter/material.dart';

Widget navigationTile({
  required BuildContext context,
  required Map<String, dynamic> item,
  required bool isSelected,
  required VoidCallback onTap,
  bool showLabel = true,
  bool isCompact = false,
  bool isHovered = false,
}) {
  final theme = Theme.of(context);
  final cs = theme.colorScheme;

  final accent = cs.primary;
  final iconColor = isSelected ? accent : cs.onSurfaceVariant;
  final textColor = isSelected ? accent : cs.onSurface;
  final bgColor = isSelected
      ? accent.withAlpha(11)
      : (isHovered ? accent.withAlpha(4) : null);

  return AnimatedContainer(
    duration: const Duration(milliseconds: 240),
    curve: Curves.easeInOutCubicEmphasized,
    margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
      color: bgColor,
      borderRadius: BorderRadius.circular(12),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      hoverColor: accent.withAlpha(6),
      splashColor: accent.withAlpha(16),
      highlightColor: Colors.transparent,
      child: Stack(
        alignment: Alignment.centerLeft,
        children: [
          // Left accent bar – smoother fade + slight width animation
          AnimatedContainer(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOut,
            width: isSelected ? 5 : 0,
            height: 32,
            margin: const EdgeInsets.only(left: 4),
            decoration: BoxDecoration(
              color: accent,
              borderRadius: BorderRadius.circular(3),
            ),
          ),

          // Main content
          Padding(
            padding: isCompact
                ? const EdgeInsets.symmetric(horizontal: 12, vertical: 14)
                : const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedScale(
                  scale: isSelected ? 1.12 : 1.0,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOutBack,
                  child: Icon(
                    item['icon'] as IconData,
                    size: isCompact ? 24 : 26,
                    color: iconColor,
                  ),
                ),

                if (showLabel) ...[
                  const SizedBox(width: 16),

                  Expanded(
                    child: AnimatedDefaultTextStyle(
                      duration: const Duration(milliseconds: 240),
                      style: theme.textTheme.titleMedium!.copyWith(
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                        color: textColor,
                        letterSpacing: -0.1,
                      ),
                      child: Text(
                        item['title'] as String,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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