import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_leave_functions/employee_leave_request_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_leave_functions/employee_leave_request_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../../../../work_phelo_components/widgets/misc/user_avator.dart';


List<Widget> buildEmployeeLeaveRowCells(BuildContext context,
  LeaveRequestModel request,
  EmployeeModel user,WidgetRef ref,
  AppUserModel currentUser,) {
  final cs = Theme.of(context).colorScheme;

return [
  // Employee
  Row(
    children: [
      UserAvatar(initials: user.fullName.substring(0, 2)),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              user.fullName,
              style: myMainTextStyle(context).copyWith(
                fontWeight: FontWeight.w600,
                color: cs.onSurface,
              ),
            ),
            Text(
              user.email,
              style: myNoInfoStyle(context)
                  .copyWith(color: cs.onSurfaceVariant),
            ),
          ],
        ),
      ),
    ],
  ),

  // Type
  Text(
    request.type.name.toUpperCase(),
    style: myNoInfoStyle(context).copyWith(
      color: cs.onSurface,
      fontWeight: FontWeight.w500,
    ),
  ),

  // Start Date
  Text(
    "${request.startDate.day}/${request.startDate.month}/${request.startDate.year}",
    style: myNoInfoStyle(context).copyWith(
      color: cs.onSurface,
      fontWeight: FontWeight.w500,
    ),
  ),

  // End Date
  Text(
    "${request.endDate.day}/${request.endDate.month}/${request.endDate.year}",
    style: myNoInfoStyle(context)
        .copyWith(color: cs.onSurfaceVariant),
  ),

  // Reason
  Text(
    request.reason,
    style: myNoInfoStyle(context)
        .copyWith(color: cs.onSurfaceVariant),
  ),

  // Status
  _buildStatusChip(context, request.status.name),

  // Actions
  Builder(
      builder: (btnContext) => IconButton(
        icon: const Icon(UniconsLine.ellipsis_v, size: 20),
        onPressed: () {
          final box = btnContext.findRenderObject() as RenderBox;
          final overlay =
              Overlay.of(btnContext).context.findRenderObject() as RenderBox;
          final position = RelativeRect.fromRect(
            Rect.fromPoints(
              box.localToGlobal(Offset.zero, ancestor: overlay),
              box.localToGlobal(
                box.size.bottomRight(Offset.zero),
                ancestor: overlay,
              ),
            ),
            Offset.zero & overlay.size,
          );

          showMenu<String>(
            context: btnContext,
            position: position,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            items: request.status == LeaveStatus.pending
                ? [
                    PopupMenuItem(
                      value: 'approve',
                      child: Row(
                        children: [
                          Icon(
                            UniconsLine.check_circle,
                            size: 16,
                            color: Colors.green,
                          ),
                          const SizedBox(width: 10),
                          Text('Approve', style: myMainTextStyle(context)),
                        ],
                      ),
                    ),
                    PopupMenuItem(
                      value: 'reject',
                      child: Row(
                        children: [
                          Icon(
                            UniconsLine.times_circle,
                            size: 16,
                            color: cs.error,
                          ),
                          const SizedBox(width: 10),
                          Text('Reject', style: myMainTextStyle(context)),
                        ],
                      ),
                    ),
                  ]
                : [
                    PopupMenuItem(
                      enabled: false,
                      child: Text(
                        'Already ${request.status.name}',
                        style: myMainTextStyle(context)
                            .copyWith(color: cs.onSurfaceVariant),
                      ),
                    ),
                  ],
          ).then((value) {
            if (value == 'approve') {
              ref
                  .read(leaveProvider.notifier)
                  .approveLeave(request.id, currentUser.email);
            } else if (value == 'reject') {
              ref
                  .read(leaveProvider.notifier)
                  .rejectLeave(request.id, currentUser.email);
            }
          });
        },
      ),
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
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: color.withAlpha(15),
      borderRadius: BorderRadius.circular(appRadius),
    ),
    child: Center(
      child: Text(
        status,
        style: myMainTextStyle(
          context,
        ).copyWith(color: color, fontSize: 13, fontWeight: FontWeight.w600),
      ),
    ),
  );
}
