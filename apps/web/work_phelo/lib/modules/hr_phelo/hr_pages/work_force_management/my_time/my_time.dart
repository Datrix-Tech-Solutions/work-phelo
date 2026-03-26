import 'package:flutter/material.dart';
import '../../../../../work_phelo_components/widgets/custom_lists/app_table_widget.dart';
import 'my_time_widgets/employee_logs_list.dart';

class MyTimePlanner extends StatelessWidget {
  const MyTimePlanner({super.key});

  @override
  Widget build(BuildContext context) {
    return AppTableWidget(
      noDataText: 'No attendance records found.',
      headerTitle: 'Attendance log',
      // search: CustomSearchField(hinttext: 'search employees'),
      // search: CustomSearchField(hinttext: 'Search employee...'),
      // Row(
      //   children: [
      //     Expanded(
      //       flex: 3,
      //       child: CustomSearchField(hinttext: 'Search employee...'),
      //     ),
      //     const SizedBox(width: 12),
      //     Expanded(
      //       child: MyDropdownField(
      //         placeholder: 'Filter by department',
      //         items: ['All departments'],
      //       ),
      //     ),
      //     Spacer(),
      //   ],
      // ),
      columns: [
        TableColumn(header: 'Employee', width: FlexColumnWidth(4)),
        TableColumn(header: 'Date', width: FlexColumnWidth(1)),
        TableColumn(header: 'Clock In', width: FlexColumnWidth(1)),
        TableColumn(header: 'Clock Out', width: FlexColumnWidth(1)),
        TableColumn(header: 'Duration', width: FlexColumnWidth(1)),
        TableColumn(header: 'Status', width: FixedColumnWidth(100)),
        TableColumn(header: '', width: FixedColumnWidth(100)),
      ],
      itemCount: 10,
      rowBuilder: buildEmployeeLogCells,
    );
  }
}
