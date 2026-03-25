import 'package:flutter/material.dart';

import '../../app_theme/text_styles.dart';

class AppNavItem extends StatefulWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const AppNavItem({
    super.key,
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<AppNavItem> createState() => _AppNavItemState();
}

class _AppNavItemState extends State<AppNavItem> {
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = cs.primary;

    final iconColor = widget.isSelected ? accent : cs.onSurfaceVariant;
    final textColor = widget.isSelected ? accent : cs.onSurfaceVariant;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),

          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(widget.icon, size: 15, color: iconColor),
                  const SizedBox(width: 6),
                  Text(
                    widget.label,
                    style: myMainTextStyle(context).copyWith(
                      fontSize: 13,
                      fontWeight: widget.isSelected
                          ? FontWeight.w600
                          : FontWeight.w400,
                      color: textColor,
                    ),
                  ),
                ],
              ),
              // ── Underline indicator ──────────────────────
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                margin: const EdgeInsets.only(top: 3),
                height: 2,
                width: widget.isSelected ? 40 : 0,
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
