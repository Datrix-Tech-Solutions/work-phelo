import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_asset_management_functions/asset_icons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_asset_management_functions/company_asset_model.dart';

import '../../../../../work_phelo_components/theme/app_padding.dart';
import '../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../employee_management/employees/employee_page_wigets.dart/employee_card.dart';


class AssetCard extends StatefulWidget {
  final AssetModel asset;
  final VoidCallback? onEdit;
  final VoidCallback? onAssign;
  final VoidCallback? onDelete;

  const AssetCard({
    super.key,
    required this.asset,
    this.onEdit,
    this.onAssign,
    this.onDelete,
  });

  @override
  State<AssetCard> createState() => _AssetCardState();
}

class _AssetCardState extends State<AssetCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);
    final icon = getAssetIcon(widget.asset.assetType);

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: SystemMouseCursors.click,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: BorderRadius.circular(appRadius),
          border: Border.all(
            color: _hovered ? cs.outlineVariant : cs.outline,
            width: 0.5,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: myDisplayContentPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ListTile(
                    leading: CircleAvatar(
                      backgroundColor: cs.primaryContainer.withAlpha(80),
                      child: Icon(
                        icon,
                        color: cs.primary,
                        size: 28,
                      ),
                    ),
                    title: Text(
                      widget.asset.assetName,
                      style: myMainTextStyle(context).copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      widget.asset.assetType,
                      style: myNoInfoStyle(context).copyWith(
                        color: cs.onSurfaceVariant,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: StatusBadge(
                      bg: Colors.green.withAlpha(10),
                      fg: Colors.green,
                      label: '• ${widget.asset.availability}',
                    ),
                  ),

                  Row(
                    children: [
                      Expanded(
                        child: MetaCell(
                          label: 'serial number',
                          value: widget.asset.serialNumber,
                        ),
                      ),
                      Expanded(
                        child: MetaCell(
                          label: 'assetID',
                          value: widget.asset.id,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: MetaCell(
                          label: 'date purchased',
                          value: _formatDate(widget.asset.purchaseDate),
                        ),
                      ),
                      Expanded(
                        child: MetaCell(
                          label: 'condition',
                          value: widget.asset.assetCondition,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),
                  myDivider(context),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      ActionsRow(
                        btnIcon: UniconsLine.edit,
                        btnText: 'Edit',
                        onPressed: (){},
                        btnAccent: Colors.blue,
                      ),
                      ActionsRow(
                        btnIcon: UniconsLine.user_plus,
                        btnText: 'Assign',
                        onPressed: (){},
                        btnAccent: Colors.orange,
                      ),
                      ActionsRow(
                        btnIcon: UniconsLine.trash,
                        btnText: 'Delete',
                        onPressed: (){},
                        btnAccent: Colors.red,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return "${date.day.toString().padLeft(2, '0')}/"
           "${date.month.toString().padLeft(2, '0')}/"
           "${date.year}";
  }
}

class ActionsRow extends StatelessWidget {
  final IconData btnIcon;
  final String btnText;
  final VoidCallback onPressed;
  final Color btnAccent;
  const ActionsRow({
    super.key,
    required this.btnIcon,
    required this.btnText,
    required this.onPressed,
    required this.btnAccent,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(appRadius),
        ),
        elevation: 0,
        color: btnAccent.withAlpha(10),
        child: InkWell(
          onTap: onPressed,
          child: Padding(
            padding: myContentPadding,
            child: Center(
              child: Text(
                btnText,
                style: myNoInfoStyle(context).copyWith(color: btnAccent),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
