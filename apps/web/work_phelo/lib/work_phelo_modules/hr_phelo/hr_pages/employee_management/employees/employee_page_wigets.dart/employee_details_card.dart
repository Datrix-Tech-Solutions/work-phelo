import 'package:flutter/material.dart';
import 'package:work_phelo/work_phelo_components/theme/app_padding.dart';

import '../../../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../../../work_phelo_components/theme/miscellaneouse.dart';

class EmployeeDetailsCard extends StatelessWidget {
  final String cardTitle;
  final List<DetailItem> details;

  const EmployeeDetailsCard({
    super.key,
    required this.cardTitle,
    required this.details,
  });

  @override
  Widget build(BuildContext context) {
    return Card.outlined(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(appRadius / 2),
        side: BorderSide(color: ColorScheme.of(context).outline, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: formWidgetPadding + myPadding,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.outlineVariant.withAlpha(30),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(appRadius),
                topRight: Radius.circular(appRadius),
              ),
            ),
            child: sectionHeader(context, cardTitle),
          ),

          // Dynamic Content Area
          Padding(
            padding: myDisplayContentPadding,
            child: Wrap(
              spacing: 48,
              runSpacing: 28,
              children: details
                  .map((item) => _infoColumn(context, item.label, item.value))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoColumn(BuildContext context, String label, String value) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 50.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 15),
          Text(
            label,
            style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            style: myNoInfoStyle(
              context,
            ).copyWith(fontWeight: FontWeight.w600, color: cs.onSurface),
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }
}

class DetailItem {
  final String label;
  final String value;

  const DetailItem({required this.label, required this.value});
}






