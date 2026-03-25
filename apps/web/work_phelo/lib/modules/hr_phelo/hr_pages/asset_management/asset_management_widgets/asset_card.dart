import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../../components/App_Theme/text_styles.dart';
import '../../../../../components/app_theme/misc.dart';
import '../../../../../components/app_theme/padding.dart';
import '../../../../../components/app_widgets/cards/employee_card.dart';

class AssetCard extends StatefulWidget {
  const AssetCard({super.key});

  @override
  State<AssetCard> createState() => _AssetCardState();
}

class _AssetCardState extends State<AssetCard> {
  bool _hovered = false;
  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);
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
            // ── details ─────────────────────────────────────
            Padding(
              padding: myDisplayContentPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ListTile(
                    leading: CircleAvatar(child: Icon(UniconsLine.monitor)),
                    title: Text(
                      'Asset name',
                      style: myMainTextStyle(
                        context,
                      ).copyWith(fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      'asset type',
                      style: myNoInfoStyle(
                        context,
                      ).copyWith(color: cs.onSurfaceVariant),
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: StatusBadge(
                      bg: Colors.green.withAlpha(10),
                      fg: Colors.green,
                      label: '• assigned',
                    ),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: MetaCell(
                          label: 'serial number',
                          value: 'J2323NUB4',
                        ),
                      ),
                      Expanded(
                        child: MetaCell(label: 'assetID', value: 'LPT-001'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: MetaCell(
                          label: 'date purchased',
                          value: 'dd/mm/yyy',
                        ),
                      ),
                      Expanded(
                        child: MetaCell(label: 'condition', value: 'good'),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),
                  myDivider(context),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      ActionsRow(
                        btnIcon: UniconsLine.abacus,
                        btnText: 'Edit',
                        onPressed: () {},
                        btnAccent: Colors.blue,
                      ),
                      ActionsRow(
                        btnIcon: UniconsLine.abacus,
                        btnText: 'Assign',
                        onPressed: () {},
                        btnAccent: Colors.orange,
                      ),
                      ActionsRow(
                        btnIcon: UniconsLine.abacus,
                        btnText: 'Delete',
                        onPressed: () {},
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
