import 'package:flutter/material.dart';
import '../../app_theme/misc.dart';
import '../../app_theme/padding.dart';
import '../../app_theme/text_styles.dart';
import '../../form_components/my_buttons.dart';

class MenuCard extends StatefulWidget {
  const MenuCard({
    super.key,
    required this.icon,
    required this.moduleName,
    required this.description,
    required this.infoItems,
    required this.dataItems,
    this.accentColor,
    required this.onLaunch,
    this.isEnabled = true,
  });

  final IconData icon;
  final String moduleName;
  final String description;
  final List<String> infoItems;
  final List<({String title, String subtitle})> dataItems;
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
    // ← grey out everything when disabled
    final accent = widget.isEnabled
        ? (widget.accentColor ?? colorScheme.primary)
        : colorScheme.onSurface.withAlpha(40);

    return MouseRegion(
      onEnter: (_) =>
          widget.isEnabled ? setState(() => _isHovered = true) : null,
      onExit: (_) =>
          widget.isEnabled ? setState(() => _isHovered = false) : null,
      cursor: widget.isEnabled
          ? SystemMouseCursors.click
          : SystemMouseCursors.forbidden, // ← forbidden cursor when disabled
      child: Opacity(
        opacity: widget.isEnabled ? 1.0 : 0.45, // ← greyed out
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeInOutCubicEmphasized,
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(appRadius)),
          child: AnimatedScale(
            scale: _isHovered ? 1.001 : 1.0,
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
            child: Material(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(appRadius),
              clipBehavior: Clip.antiAlias,
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: _isHovered ? accent : colorScheme.outline,
                    width: _isHovered ? 1.0 : 0.7,
                  ),
                  borderRadius: BorderRadius.circular(appRadius),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Card.outlined(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(appRadius),
                              side: BorderSide(
                                width: 1,
                                color: _isHovered
                                    ? accent
                                    : colorScheme.outline,
                              ),
                            ),
                            color: _isHovered
                                ? accent.withAlpha(50)
                                : colorScheme.surface,
                            child: Padding(
                              padding: myContentPadding,
                              child: Icon(
                                widget.icon,
                                size: 30,
                                color: _isHovered
                                    ? accent
                                    : colorScheme.outline,
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  widget.moduleName,
                                  style: myTitleTextStyle(context),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.description,
                                  style: myMainTextStyle(context),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (widget.infoItems.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Wrap(
                          spacing: 12,
                          runSpacing: 10,
                          children: widget.infoItems.map((text) {
                            return _InfoChip(label: text, accentColor: accent);
                          }).toList(),
                        ),
                      ],
                      const SizedBox(height: 24),
                      myDivider(context),
                      const SizedBox(height: 24),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Wrap(
                            spacing: 24,
                            runSpacing: 16,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: widget.dataItems.map((item) {
                              return _DataItem(
                                title: item.title,
                                subtitle: item.subtitle,
                              );
                            }).toList(),
                          ),
                          const Spacer(),
                          MyOutlinedButton(
                            btnText: widget.isEnabled ? 'Launch' : 'Disabled',
                            btnAccent: accent,
                            btnIcon: widget.isEnabled
                                ? Icons.play_arrow_rounded
                                : Icons.lock_outline_rounded,
                            isHovered: _isHovered,
                            onPressed: widget.isEnabled
                                ? widget.onLaunch
                                : () {},
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.accentColor});

  final String label;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: accentColor.withAlpha(12),
        border: Border.all(color: accentColor.withAlpha(30), width: 1),
        borderRadius: BorderRadius.circular(appRadius),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: accentColor.withAlpha(95),
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _DataItem extends StatelessWidget {
  const _DataItem({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(title, style: myNoInfoStyle(context)),
        Text(
          subtitle,
          style: myMainTextStyle(context).copyWith(fontWeight: FontWeight.w900),
        ),
      ],
    );
  }
}
