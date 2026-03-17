import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../../../components/app_theme/text_styles.dart';
import '../../../../../../components/app_widgets/user_avators.dart';

class EmployeeRow extends StatefulWidget {
  // final Employee employee;
  final int index;
  final VoidCallback onMorePressed;

  const EmployeeRow({
    super.key,
    // required this.employee,
    required this.index,
    required this.onMorePressed,
  });

  @override
  State<EmployeeRow> createState() => _EmployeeRowState();
}

class _EmployeeRowState extends State<EmployeeRow> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: _isHovered ? cs.primary.withAlpha(4) : null,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 3,
              child: Row(
                children: [
                  UserAvators(),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Employee Name',
                          style: myMainTextStyle(context).copyWith(
                            fontWeight: FontWeight.w600,
                            color: cs.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'employee@mail.com',
                          style: myNoInfoStyle(
                            context,
                          ).copyWith(color: cs.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Department
            Expanded(
              child: Text(
                'Department',
                style: myNoInfoStyle(
                  context,
                ).copyWith(color: cs.onSurface, fontWeight: FontWeight.w500),
              ),
            ),

            // Role
            Expanded(
              child: Text(
                'employeerole',
                style: myNoInfoStyle(
                  context,
                ).copyWith(color: cs.onSurface, fontWeight: FontWeight.w500),
              ),
            ),

            // Join Year
            Expanded(
              child: Text(
                '2025',
                style: myNoInfoStyle(
                  context,
                ).copyWith(color: cs.onSurfaceVariant),
              ),
            ),

            // Status
            _buildStatusChip('status'),

            // Actions
            IconButton(
              icon: Icon(UniconsLine.ellipsis_v, size: 20),
              onPressed: widget.onMorePressed,
              tooltip: 'More actions',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(String status) {
    final color = switch (status.toLowerCase()) {
      'active' => Colors.green,
      'on leave' => Colors.orange,
      'inactive' => Colors.red,
      _ => Colors.grey,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
