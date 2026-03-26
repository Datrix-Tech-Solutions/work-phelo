import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import '../../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import '../employee_management/employees/employee_page_wigets.dart/onboarding_form.dart';
import 'asset_management_widgets/asset_management_form.dart';
import 'asset_management_widgets/asset_summary.dart';
import 'asset_management_widgets/assets_lists.dart';

class AssetManagementLayout extends StatefulWidget {
  final AppUserModel currentUser;
  const AssetManagementLayout({super.key, required this.currentUser});

  @override
  State<AssetManagementLayout> createState() => _AssetManagementLayoutState();
}

class _AssetManagementLayoutState extends State<AssetManagementLayout> {
  late final _panel = SidePanelController();
  final _assetFormKey = GlobalKey<AssetManagementFormState>();
  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);
    return Column(
      children: [
        ListTile(
          title: sectionHeader(context, 'Asset Management'),
          trailing: MyOutlinedMenuButton(
            onPressed: () => _panel.show(
              context: context,
              formTitle: 'Add new Assets',
              onPressed: () {
                _assetFormKey.currentState?.submitForm();
              },
              secOnPressed: () {},
              child: AssetManagementForm(
                key: _assetFormKey,
                tenantId: widget.currentUser.tenantSlug,
                onSubmitCallback: (success, message) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(message),
                      backgroundColor: success ? Colors.green : Colors.red,
                    ),
                  );
                },
                onSuccess: () {
                  debugPrint('Asset added successfully');
                },
              ),
            ),
            btnText: 'Add Asset',
            btnIcon: UniconsLine.plus,
            btnAccent: cs.primary,
            isHovered: false,
          ),
        ),
        AssetSummary(),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(left: 8.0),
            child: DisplayCard(
              child: AssetsLists(currentUser: widget.currentUser),
            ),
          ),
        ),
        // AssetsLists(),
      ],
    );
  }
}
