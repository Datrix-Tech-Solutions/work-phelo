import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/app_theme/colors.dart';
import 'package:hr_phelo/components/app_widgets/cards/display_card.dart';
import 'package:hr_phelo/components/app_widgets/lists/app_lists.dart';
import 'package:hr_phelo/components/form_components/my_buttons.dart';
import 'package:unicons/unicons.dart';

import 'employee_page_wigets.dart/employee_list.dart';
import 'employee_page_wigets.dart/search_employee_widgets.dart';

class EmployeeLayout extends StatelessWidget {
  const EmployeeLayout({super.key});

  @override
  Widget build(BuildContext context) {
    return DisplayCard(
      child: AppTableWidget(
        headerTitle: 'Employees',
        columnHeaders: [
          'Employee',
          'Department',
          'Role',
          'year Joined',
          'Status',
          'actions',
        ],
        columnFlex: [3, 1, 1, 1, 1, 1],
        headerTrailing: MyOutlinedButton(
          btnText: 'New Employee',
          btnIcon: UniconsLine.user_plus,
          btnAccent: myMainColor,
          isHovered: false,

          onPressed: () {},
        ),
        search: buildSearchAndActionsBar(context),
        itemCount: 20,
        crossAxisCount: 1,
        childAspectRatio: 5.5,
        itemBuilder: (context, index) {
          // final employee = employees[index];

          return EmployeeRow(
            // employee: employee,
            index: index,

            onMorePressed: () {},
          );
        },
      ),
    );
  }
}
