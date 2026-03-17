import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/app_theme/padding.dart';
import 'package:hr_phelo/components/app_theme/misc.dart';
import 'package:hr_phelo/components/form_components/my_buttons.dart';

import '../../app_theme/text_styles.dart';

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
  });

  final IconData icon;
  final String moduleName;
  final String description;
  final List<String> infoItems;
  final List<({String title, String subtitle})> dataItems;
  final Color? accentColor;
  final VoidCallback onLaunch;

  @override
  State<MenuCard> createState() => _MenuCardState();
}

class _MenuCardState extends State<MenuCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final accent = widget.accentColor ?? colorScheme.primary;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeInOutCubicEmphasized,
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(8)),
        child: AnimatedScale(
          scale: _isHovered ? 1.001 : 1.0,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
          child: Material(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(8),
            clipBehavior: Clip.antiAlias,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(
                  color: _isHovered ? accent : colorScheme.outline,
                  width: _isHovered ? 1.0 : 0.7,
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Card.outlined(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(15),
                            side: BorderSide(
                              width: 1,
                              color: _isHovered ? accent : colorScheme.outline,
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
                              color: _isHovered ? accent : colorScheme.outline,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.moduleName,
                                style: myLargeTextStyle(context),
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

                    const SizedBox(height: 20),

                    if (widget.infoItems.isNotEmpty)
                      Wrap(
                        spacing: 12,
                        runSpacing: 10,
                        children: widget.infoItems.map((text) {
                          return _InfoChip(label: text, accentColor: accent);
                        }).toList(),
                      ),

                    if (widget.infoItems.isNotEmpty) const SizedBox(height: 24),
                    Spacer(),
                    myDivider(context),
                    SizedBox(height: 24),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: 32,
                            runSpacing: 16,
                            children: widget.dataItems.map((item) {
                              return _DataItem(
                                title: item.title,
                                subtitle: item.subtitle,
                              );
                            }).toList(),
                          ),
                        ),

                        const SizedBox(width: 24),

                        MyOutlinedButton(
                          btnText: 'Launch',
                          btnAccent: accent,
                          btnIcon: Icons.play_arrow_rounded,
                          isHovered: _isHovered,
                          onPressed: widget.onLaunch,
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
        borderRadius: BorderRadius.circular(20),
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
