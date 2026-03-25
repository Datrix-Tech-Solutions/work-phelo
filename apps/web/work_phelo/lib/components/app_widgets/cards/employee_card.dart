import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:unicons/unicons.dart';

import '../../../Functions/company_functions/onboarding_function/onboarding_model.dart';
import '../../app_theme/misc.dart';
import '../../app_theme/text_styles.dart';

class EmployeeCard extends StatefulWidget {
  final UserModel user;
  final VoidCallback? onTap;

  const EmployeeCard({super.key, required this.user, this.onTap});

  @override
  State<EmployeeCard> createState() => _EmployeeCardState();
}

class _EmployeeCardState extends State<EmployeeCard> {
  bool _hovered = false;

  String get _initials =>
      '${widget.user.firstName.isNotEmpty ? widget.user.firstName[0] : ''}'
              '${widget.user.lastName.isNotEmpty ? widget.user.lastName[0] : ''}'
          .toUpperCase();

  // Generate a consistent color per employee based on name
  Color get _avatarBg {
    final colors = [
      const Color(0xFFE1F5EE),
      const Color(0xFFEEEDFE),
      const Color(0xFFFAEEDA),
      const Color(0xFFFBEAF0),
      const Color(0xFFE6F1FB),
    ];
    return colors[widget.user.fullName.length % colors.length];
  }

  Color get _avatarFg {
    final colors = [
      const Color(0xFF0F6E56),
      const Color(0xFF534AB7),
      const Color(0xFF854F0B),
      const Color(0xFF993556),
      const Color(0xFF185FA5),
    ];
    return colors[widget.user.fullName.length % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final (bg, fg, label) = widget.user.status.resolve(cs);

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            color: cs.surface,
            borderRadius: BorderRadius.circular(appRadius),
            border: Border.all(
              color: _hovered ? cs.outlineVariant : cs.outline,
              width: 0.5,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Photo / initials ─────────────────────────
              Container(
                width: double.infinity,
                height: 160,
                color: _avatarBg,
                child: Center(
                  child: Text(
                    _initials,
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w500,
                      color: _avatarFg,
                    ),
                  ),
                ),
              ),

              // ── Body ─────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.user.fullName,
                      style: myMainTextStyle(
                        context,
                      ).copyWith(fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: 2),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            widget.user.jobTitle,
                            style: myNoInfoStyle(
                              context,
                            ).copyWith(color: cs.onSurfaceVariant),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        StatusBadge(bg: bg, fg: fg, label: label),
                      ],
                    ),

                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: MetaCell(
                            label: 'Department',
                            value: widget.user.department ?? '—',
                          ),
                        ),
                        Expanded(
                          child: MetaCell(
                            label: 'Date hired',
                            value: DateFormat(
                              'dd/MM/yyyy',
                            ).format(widget.user.hiredDate),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),
                    myDivider(context),
                    const SizedBox(height: 10),
                    // const Spacer(),
                    // ── Contact ─────────────────────────────
                    ContactRow(
                      icon: UniconsLine.envelope,
                      value: widget.user.email,
                    ),
                    const SizedBox(height: 5),
                    ContactRow(
                      icon: UniconsLine.phone,
                      value: widget.user.contact,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class MetaCell extends StatelessWidget {
  final String label;
  final String value;
  const MetaCell({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: myNoInfoStyle(
            context,
          ).copyWith(fontSize: 11, color: cs.onSurfaceVariant.withAlpha(160)),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: myNoInfoStyle(
            context,
          ).copyWith(fontWeight: FontWeight.w500, color: cs.onSurface),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class ContactRow extends StatelessWidget {
  final IconData icon;
  final String value;
  const ContactRow({super.key, required this.icon, required this.value});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(icon, size: 14, color: cs.onSurfaceVariant.withAlpha(150)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            value,
            style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class StatusBadge extends StatelessWidget {
  final Color bg;
  final Color fg;
  final String label;

  const StatusBadge({
    super.key,
    required this.bg,
    required this.fg,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
