import 'package:flutter/material.dart';
import 'package:work_phelo/work_phelo_components/theme/app_padding.dart';
import 'package:work_phelo/work_phelo_components/theme/miscellaneouse.dart';

class MenuCard extends StatefulWidget {
  const MenuCard({
    super.key,
    required this.icon,
    required this.moduleName,
    required this.description,
    this.accentColor,
    required this.onLaunch,
    this.isEnabled = true,
  });

  final IconData icon;
  final String moduleName;
  final String description;
  final Color? accentColor;
  final VoidCallback onLaunch;
  final bool isEnabled;

  @override
  State<MenuCard> createState() => _MenuCardState();
}

class _MenuCardState extends State<MenuCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final accent = widget.isEnabled
        ? (widget.accentColor ?? colorScheme.primary)
        : colorScheme.outline.withAlpha(100);

    return MouseRegion(
      onEnter: (_) =>
          widget.isEnabled ? setState(() => _isHovered = true) : null,
      onExit: (_) =>
          widget.isEnabled ? setState(() => _isHovered = false) : null,
      cursor: widget.isEnabled
          ? SystemMouseCursors.click
          : SystemMouseCursors.forbidden,
      child: AnimatedScale(
        scale: _isHovered && widget.isEnabled ? 1.02 : 1.0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        child: Opacity(
          opacity: widget.isEnabled ? 1.0 : 0.65,
          child: Material(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(appRadius),
            elevation: _isHovered && widget.isEnabled ? 8 : 2,
            shadowColor: accent.withAlpha(60),
            child: InkWell(
              borderRadius: BorderRadius.circular(appRadius),
              onTap: widget.isEnabled ? widget.onLaunch : null,
              child: Container(
                padding: myContentPadding,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(appRadius),
                  border: Border.all(
                    color: _isHovered && widget.isEnabled
                        ? accent
                        : colorScheme.outline.withAlpha(60),
                    width: _isHovered && widget.isEnabled ? 2.0 : 1.5,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 75,
                      height: 75,
                      decoration: BoxDecoration(
                        color: accent,
                        borderRadius: BorderRadius.circular(appRadius),
                      ),
                      child: Icon(
                        widget.icon,
                        size: 50,
                        color: colorScheme.surface,
                      ),
                    ),

                    Padding(padding: space),

                    // Module Name
                    Text(
                      widget.moduleName,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                        fontSize: 22,
                      ),
                      textAlign: TextAlign.center,
                    ),

                    const SizedBox(height: 12),

                    // Description
                    Text(
                      widget.description,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        height: 1.4,
                        fontSize: 15.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
