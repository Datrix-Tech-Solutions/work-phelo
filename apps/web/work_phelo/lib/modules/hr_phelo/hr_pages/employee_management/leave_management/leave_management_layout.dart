import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../Functions/company_functions/leave_function/leave_state.dart';
import '../../../../../Functions/company_functions/onboarding_function/user_state.dart';
import '../../../../../components/app_theme/colors.dart';
import '../../../../../components/app_widgets/lists/app_lists.dart';
import '../../../../../components/form_components/my_buttons.dart';
import '../../../../../components/form_components/my_side_panel.dart';
import 'leave_management_widgets/employee_leave_list.dart';
import 'leave_management_widgets/leave_form.dart';

class LeaveManagementLayout extends ConsumerStatefulWidget {
  final AppUser currentUser;
  const LeaveManagementLayout({super.key, required this.currentUser});

  @override
  ConsumerState<LeaveManagementLayout> createState() =>
      _LeaveManagementLayoutState();
}

class _LeaveManagementLayoutState extends ConsumerState<LeaveManagementLayout> {
  final _panel = SidePanelController();
  final _leaveFormKey = GlobalKey<LeaveFormState>();
  @override
  Widget build(BuildContext context) {
    final leaveRequests = ref.watch(leaveProvider).requests;

    final users = ref.watch(
      usersByTenantProvider(widget.currentUser.tenantSlug),
    );

    // filter by tenant
    final tenantRequests = leaveRequests
        .where((r) => r.tenantSlug == widget.currentUser.tenantSlug)
        .toList();

    return AppTableWidget(
      headerTitle: 'Employees',
      details: 'Manage your workforce',
      headerTrailing: MyOutlinedButton(
        btnText: 'Request Leave',
        btnIcon: UniconsLine.user_plus,
        btnAccent: myMainColor,
        isHovered: false,
        onPressed: () => _panel.show(
          context: context,
          formTitle: 'Leave Form',
          secOnPressed:
              () => // ← reset
                  _leaveFormKey.currentState?.reset(),
          onPressed: () {
            _leaveFormKey.currentState?.submit();
            _panel.close();
          },
          child: LeaveForm(currentUser: widget.currentUser),
        ),
      ),

      columns: const [
        TableColumn(header: 'Employee', width: FlexColumnWidth(4)),
        TableColumn(header: 'Type', width: FlexColumnWidth(1)),
        TableColumn(header: 'start Date', width: FlexColumnWidth(1)),
        TableColumn(header: 'End Date', width: FlexColumnWidth(1)),
        TableColumn(header: 'Reason', width: FlexColumnWidth(1)),
        TableColumn(header: 'Status', width: FlexColumnWidth(1)),
        TableColumn(header: '', width: FixedColumnWidth(48)),
      ],

      itemCount: tenantRequests.length,

      rowBuilder: (context, index) {
        final request = tenantRequests[index];
        final user = users
            .where((u) => u.email == request.employeeEmail)
            .firstOrNull;
        if (user == null) return [const SizedBox()];
        return buildEmployeeLeaveRowCells(
          context,
          request,
          user,
          ref,
          widget.currentUser,
        );
      },
    );
  }
}
