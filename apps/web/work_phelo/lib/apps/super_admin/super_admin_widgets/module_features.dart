import 'package:flutter/material.dart';
import 'package:work_phelo/work_phelo_components/theme/app_padding.dart';

import '../../../work_phelo_components/theme/app.colors.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_funtions/work_phelo_super_admin/work_phelo_features.dart';

class ModuleFeatures extends StatefulWidget {
  final String moduleKey;

  const ModuleFeatures({super.key, required this.moduleKey});

  @override
  State<ModuleFeatures> createState() => _ModuleFeaturesState();
}

class _ModuleFeaturesState extends State<ModuleFeatures> {
  late List<FeatureItem> _features;

  @override
  void initState() {
    super.initState();
    _features = ModuleFeaturesData.getFeaturesForModule(widget.moduleKey);
  }

  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Module Features",
          style: myMainTextStyle(
            context,
          ).copyWith(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        Text(
          "Enable or disable specific features for this module",
          style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 28),

        Expanded(
          child: ListView.builder(
            itemCount: _features.length,
            padding: const EdgeInsets.only(right: 8),
            itemBuilder: (context, index) => _buildFeatureRow(context, index),
          ),
        ),
      ],
    );
  }

  Widget _buildFeatureRow(BuildContext context, int index) {
    final feature = _features[index];
    final cs = ColorScheme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: myContentPadding,
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: feature.isEnabled
              ? myMainColor.withAlpha(180)
              : cs.outline.withAlpha(50),
          width: feature.isEnabled ? 1.8 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              feature.name,
              style: myMainTextStyle(
                context,
              ).copyWith(fontWeight: FontWeight.w600, fontSize: 15.5),
            ),
          ),
          Switch(
            value: feature.isEnabled,
            activeThumbColor: myMainColor,
            onChanged: (value) {
              setState(() {
                _features[index].isEnabled = value;
              });
            },
          ),
        ],
      ),
    );
  }
}
