import 'package:flutter/material.dart';
import 'package:work_phelo/modules/hr_phelo/hr_pages/employee_management/appraisal/appraisal_widgets/create_appraisal_form.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

// class AppraisalLayout extends StatelessWidget {
//   final AppUserModel currentUser;
//   const AppraisalLayout({super.key, required this.currentUser});

//   @override
//   Widget build(BuildContext context) {
//     return Center(
//       child: AssignAppraisalForm(tenantSlug: currentUser.tenantSlug),
//     );
//   }
// }
// class AppraisalLayout extends StatelessWidget {
//   final AppUserModel currentUser;
//   final AppraisalRecord record;
//   const AppraisalLayout({
//     super.key,
//     required this.currentUser,
//     required this.record,
//   });

//   @override
//   Widget build(BuildContext context) {
//     return Center(
//       child: EmployeeAppraisalForm(
//         record: record,
//         currentUserEmail: currentUser.email,
//       ),
//     );
//   }
// }
class AppraisalLayout extends StatelessWidget {
  final AppUserModel currentUser;
  const AppraisalLayout({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: CreateAppraisalTemplateForm(
        tenantSlug: currentUser.tenantSlug,
        createdBy: currentUser.email,
      ),
    );
  }
}
