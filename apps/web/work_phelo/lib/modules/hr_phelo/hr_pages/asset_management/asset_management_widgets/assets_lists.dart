import 'package:flutter/material.dart';


import '../../../../../components/app_theme/padding.dart';
import 'asset_card.dart';

class AssetsLists extends StatefulWidget {
  const AssetsLists({super.key});

  @override
  State<AssetsLists> createState() => _AssetsListsState();
}

class _AssetsListsState extends State<AssetsLists> {
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossCount = constraints.maxWidth >= 1200
            ? 5
            : constraints.maxWidth >= 900
            ? 4
            : constraints.maxWidth >= 600
            ? 3
            : 2;

        return Padding(
          padding: myContentPadding,
          child: GridView.builder(
            padding: const EdgeInsets.only(top: 8),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossCount,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              mainAxisExtent: 270,
            ),
            itemCount: 18,
            itemBuilder: (context, index) => AssetCard(),
          ),
        );
      },
    );
  }
}
