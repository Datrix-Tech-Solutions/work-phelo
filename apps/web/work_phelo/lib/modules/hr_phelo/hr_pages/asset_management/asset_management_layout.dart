import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../components/app_widgets/cards/display_card.dart';
import '../../../../components/form_components/my_buttons.dart';
import '../../../../components/form_components/my_side_panel.dart';
import '../employee_management/employees/employee_page_wigets.dart/onboarding_form.dart';
import 'asset_management_widgets/asset_management_form.dart';
import 'asset_management_widgets/asset_summary.dart';
import 'asset_management_widgets/assets_lists.dart';

class AssetManagementLayout extends StatefulWidget {
  const AssetManagementLayout({super.key});

  @override
  State<AssetManagementLayout> createState() => _AssetManagementLayoutState();
}

class _AssetManagementLayoutState extends State<AssetManagementLayout> {
  late final _panel = SidePanelController();
  // final _formKey = GlobalKey<AssetManagementFormState>();
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
              onPressed: () {},
              secOnPressed: () {},
              child: AssetManagementForm(),
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
            child: DisplayCard(child: AssetsLists()),
          ),
        ),
        // AssetsLists(),
      ],
    );
  }
}
