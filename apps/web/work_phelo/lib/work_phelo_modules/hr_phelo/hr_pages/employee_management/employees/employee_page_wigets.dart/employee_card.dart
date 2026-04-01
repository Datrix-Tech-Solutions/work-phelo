import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_components/theme/app_padding.dart';

import '../../../../../../work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/theme/miscellaneouse.dart';

class EmployeeCard extends StatefulWidget {
  final EmployeeModel user;
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
                      value: widget.user.contact??'-',
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
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '• $label',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

//////
///

class EmployeeSummaryCard extends StatefulWidget {
  final EmployeeModel user;
  const EmployeeSummaryCard({super.key, required this.user});

  @override
  State<EmployeeSummaryCard> createState() => _EmployeeSummaryCardState();
}

class _EmployeeSummaryCardState extends State<EmployeeSummaryCard> {
  String get _initials =>
      '${widget.user.firstName.isNotEmpty ? widget.user.firstName[0] : ''}'
              '${widget.user.lastName.isNotEmpty ? widget.user.lastName[0] : ''}'
          .toUpperCase();

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
    return Padding(
      padding: myContentPadding,
      child: Card.outlined(
        elevation: 1,
        margin: const EdgeInsets.only(bottom: 24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(appRadius / 2),
          side: BorderSide(color: ColorScheme.of(context).outline, width: 0.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
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
            Padding(padding: space),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: myContentPadding,
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: 'Email Address: ',
                          style: myNoInfoStyle(context),
                        ),
                        TextSpan(
                          text: widget.user.email,
                          style: myMainTextStyle(
                            context,
                          ).copyWith(fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: myContentPadding,
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: 'Phone Number: ',
                          style: myNoInfoStyle(context),
                        ),
                        TextSpan(
                          text: widget.user.contact,
                          style: myMainTextStyle(
                            context,
                          ).copyWith(fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
