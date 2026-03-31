import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_components/theme/app_padding.dart';
import 'package:work_phelo/work_phelo_components/widgets/form_components/app_buttons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import '../../../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import 'departments_list.dart';
import 'manage_dept_subpages/create_department_form.dart';

class ManageDepartmentPage extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
  const ManageDepartmentPage({super.key, required this.currentUser});

  @override
  ConsumerState<ManageDepartmentPage> createState() =>
      _ManageDepartmentPageState();
}

class _ManageDepartmentPageState extends ConsumerState<ManageDepartmentPage> {
  late final _panel = SidePanelController();
  final _formKey = GlobalKey<CreateDepartmentFormState>();
  @override
  Widget build(BuildContext context) {
    return DisplayCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────
          ListTile(
            title: Text('Manage Departments', style: myTitleTextStyle(context)),
            subtitle: Text(
              'Create departments and assign to employees',
              style: myMainTextStyle(
                context,
              ).copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
            trailing: MyOutlinedMenuButton(
              onPressed: () => _panel.show(
                context: context,
                formTitle: 'Company Editing Form',
                onPressed: () {
                  _formKey.currentState?.submit();
                },
                secOnPressed: () => _formKey.currentState?.reset(),
                child: CreateDepartmentForm(key: _formKey),
              ),
              btnText: 'New Department',
              btnIcon: UniconsLine.plus,
              btnAccent: ColorScheme.of(context).primary,
              isHovered: true,
            ),
          ),

          // ── Content ────────────────────────────────────
          Expanded(
            child: Padding(
              padding: myContentPadding,
              child: DepartmentsList(currentUser: widget.currentUser),
            ),
          ),
        ],
      ),
    );
  }
}
