import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_leave_functions/employee_leave_request_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../../work_phelo_components/theme/app.colors.dart';
import '../../../../../work_phelo_components/widgets/custom_lists/app_table_widget.dart';
import '../../../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import 'leave_management_widgets/employee_leave_list.dart';
import 'leave_management_widgets/leave_form.dart';

class LeaveManagementLayout extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
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
      noDataText: 'No leave requests found.',
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
