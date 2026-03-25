import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../Components/App_Theme/text_styles.dart';

class ManagementPage extends StatelessWidget {
  final ValueChanged<int> onNavigate;
  const ManagementPage({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(30.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ────────────────────────────────────────
          Text('Company management', style: myLargeTextStyle(context)),
          const SizedBox(height: 4),
          Text(
            'Configure your workspace, people, and access controls',
            style: myMainTextStyle(
              context,
            ).copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 32),

                  // ── Organisation ──────────────────────────────────
                  _sectionHeader(context, 'Organisation'),
                  const SizedBox(height: 10),
                  _cardGrid(context, [
                    _ManagementItem(
                      icon: UniconsLine.building,
                      title: 'Departments',
                      description:
                          'Create and manage departments, assign heads',
                      onTap: () => onNavigate(0),
                    ),
                    _ManagementItem(
                      icon: UniconsLine.users_alt,
                      title: 'Employees',
                      description:
                          'Add employees, manage roles and employment status',
                      onTap: () => onNavigate(1),
                    ),
                  ]),

                  const SizedBox(height: 28),

                  // ── Access & Permissions ──────────────────────────
                  _sectionHeader(context, 'Access & permissions'),
                  const SizedBox(height: 10),
                  _cardGrid(context, [
                    _ManagementItem(
                      icon: UniconsLine.lock,
                      title: 'Roles & permissions',
                      description: 'Control what each role can view and manage',
                      onTap: () => onNavigate(2),
                    ),
                    _ManagementItem(
                      icon: UniconsLine.user_check,
                      title: 'Admin accounts',
                      description:
                          'Manage who has admin access to this workspace',
                      onTap: () => onNavigate(3),
                    ),
                    _ManagementItem(
                      icon: UniconsLine.shield,
                      title: 'Audit log',
                      description:
                          'Track all changes made across the workspace',
                      onTap: () => onNavigate(4),
                    ),
                  ]),

                  const SizedBox(height: 28),

                  // ── Settings ──────────────────────────────────────
                  _sectionHeader(context, 'Settings'),
                  const SizedBox(height: 10),
                  _cardGrid(context, [
                    _ManagementItem(
                      icon: UniconsLine.setting,
                      title: 'General settings',
                      description:
                          'Company name, timezone, working hours, locale',
                      onTap: () => onNavigate(5),
                    ),
                  ]),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, String title) {
    return Text(
      title.toUpperCase(),
      style: myMainTextStyle(context).copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }

  Widget _cardGrid(BuildContext context, List<_ManagementItem> items) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 800 ? 3 : 2;
        return GridView.count(
          crossAxisCount: crossAxisCount,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 3.2,
          children: items.map((item) => _ManagementCard(item: item)).toList(),
        );
      },
    );
  }
}

// ── Card ───────────────────────────────────────────────────────────────────

class _ManagementItem {
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  const _ManagementItem({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });
}

class _ManagementCard extends StatefulWidget {
  final _ManagementItem item;
  const _ManagementCard({required this.item});

  @override
  State<_ManagementCard> createState() => _ManagementCardState();
}

class _ManagementCardState extends State<_ManagementCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.item.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: cs.surface,
            border: Border.all(
              color: _hovered ? cs.primary : cs.outlineVariant,
              width: _hovered ? 1.0 : 0.5,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _hovered
                      ? cs.primary.withAlpha(20)
                      : cs.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  widget.item.icon,
                  size: 18,
                  color: _hovered ? cs.primary : cs.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.item.title,
                      style: myMainTextStyle(context).copyWith(
                        fontWeight: FontWeight.w500,
                        color: _hovered ? cs.primary : cs.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.item.description,
                      style: myMainTextStyle(
                        context,
                      ).copyWith(fontSize: 12, color: cs.onSurfaceVariant),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: _hovered ? cs.primary : cs.outlineVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
