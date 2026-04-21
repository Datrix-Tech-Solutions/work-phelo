import 'package:flutter/material.dart';

import '../../../work_phelo_funtions/work_phelo_companies/company_departments_funtions/company_departments_model.dart';
import '../../../work_phelo_funtions/work_phelo_companies/employee_permission_funtions/company_modules_model.dart';
import '../../theme/app_text_theme.dart';
import '../../theme/miscellaneouse.dart';

class ChipCard extends StatefulWidget {
  final String name;
  final String description;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;
  final bool isLocked;
  final IconData? icon;

  const ChipCard({
    super.key,
    required this.name,
    required this.description,
    required this.color,
    required this.isSelected,
    required this.onTap,
    this.isLocked = false,
    this.icon,
  });


  factory ChipCard.fromRole({
    required EmployeePermission role,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return ChipCard(
      name: role.name,
      description: role.description,
      color: role.color,
      isSelected: isSelected,
      onTap: onTap,
      isLocked: role.isLocked,
    );
  }

  factory ChipCard.fromDepartment({
    required CompanyDepartmentsModel department,
    required bool isSelected,
    required VoidCallback onTap,
    String? subtitle,
  }) {
    return ChipCard(
      name: department.name,
      description: subtitle ?? '${department.memberCount} members',
      color: department.color,
      isSelected: isSelected,
      onTap: onTap,
      icon: department.icon,
    );
  }

  @override
  State<ChipCard> createState() => _ChipCardState();
}

class _ChipCardState extends State<ChipCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: widget.isSelected ? widget.color.withAlpha(12) : cs.surface,
            border: Border.all(
              color: widget.isSelected
                  ? widget.color
                  : _hovered
                  ? cs.outline
                  : cs.outlineVariant,
              width: widget.isSelected ? 1.0 : 0.5,
            ),
            borderRadius: BorderRadius.circular(appRadius),
          ),
          child: Row(
            children: [
              // ── Dot or icon ───────────────────────────────
              widget.icon != null
                  ? Icon(widget.icon, size: 14, color: widget.color)
                  : Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: widget.color,
                        shape: BoxShape.circle,
                      ),
                    ),
              const SizedBox(width: 10),

              // ── Name + description ────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.name,
                      style: myMainTextStyle(
                        context,
                      ).copyWith(fontWeight: FontWeight.w500),
                    ),
                    Text(
                      widget.description,
                      style: myMainTextStyle(
                        context,
                      ).copyWith(fontSize: 11, color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),

              // ── Locked badge (roles only) ─────────────────
              if (widget.isLocked)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: widget.color.withAlpha(20),
                    borderRadius: BorderRadius.circular(appRadius),
                  ),
                  child: Text(
                    'locked',
                    style: myMainTextStyle(
                      context,
                    ).copyWith(fontSize: 10, color: widget.color),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class AddExtraCardChip extends StatefulWidget {
  final bool isSelected;
  final VoidCallback onTap;
  final String chipLabel;

  const AddExtraCardChip({
    super.key,
    required this.isSelected,
    required this.onTap,
    required this.chipLabel
  });

  @override
  State<AddExtraCardChip> createState() => AddExtraCardChipState();
}

class AddExtraCardChipState extends State<AddExtraCardChip> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            border: Border.all(
              color: widget.isSelected || _hovered
                  ? cs.primary
                  : cs.outlineVariant,
              width: 0.5,
              strokeAlign: BorderSide.strokeAlignInside,
            ),
            borderRadius: BorderRadius.circular(appRadius),
          ),
          child: Row(
            children: [
              Icon(Icons.add, size: 14, color: cs.onSurfaceVariant),
              const SizedBox(width: 8),
              Text(
                widget.chipLabel,
                style: myMainTextStyle(
                  context,
                ).copyWith(color: cs.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
