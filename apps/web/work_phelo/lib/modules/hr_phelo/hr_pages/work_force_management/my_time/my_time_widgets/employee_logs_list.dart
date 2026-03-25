import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../../../Components/app_theme/text_styles.dart';
import '../../../../../../components/app_theme/misc.dart';
import '../../../../../../components/app_widgets/user_avators.dart';

List<Widget> buildEmployeeLogCells(BuildContext context, int index) {
  final cs = Theme.of(context).colorScheme;
  return [
    // Cell 1 — Employee
    Row(
      children: [
        UserAvatar(initials: 'Ag'),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Employee Name',
                style: myMainTextStyle(
                  context,
                ).copyWith(fontWeight: FontWeight.w600, color: cs.onSurface),
              ),
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
    ), // Cell 2 — type
    Text(
      'dd/mm/yyy',
      style: myNoInfoStyle(
        context,
      ).copyWith(color: cs.onSurface, fontWeight: FontWeight.w500),
    ),
    // Cell 3 — start date
    Text(
      'hh:mm',
      style: myNoInfoStyle(
        context,
      ).copyWith(color: cs.onSurface, fontWeight: FontWeight.w500),
    ),
    // Cell 4 — end date
    Text(
      'hh:mm',
      style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
    ),
    // Cell 5 — reason
    Text(
      '88h 00m',
      style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
    ),
    // Cell 6 — Status
    _buildStatusChip(context, 'pending'),
    // Cell 7 — Actions
    IconButton(
      icon: const Icon(UniconsLine.ellipsis_v, size: 20),
      onPressed: () {},
      tooltip: 'More actions',
    ),
  ];
}

Widget _buildStatusChip(BuildContext context, String status) {
  final color = switch (status.toLowerCase()) {
    'approved' => Colors.green,
    'pending' => Colors.orange,
    'rejected' => Colors.red,
    _ => Colors.grey,
  };
  return Container(
    // padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: color.withAlpha(15),
      borderRadius: BorderRadius.circular(appRadius),
    ),
    child: Center(
      child: Text(
        '● $status',
        style: myMainTextStyle(
          context,
        ).copyWith(color: color, fontSize: 13, fontWeight: FontWeight.w600),
      ),
    ),
  );
}
