import 'package:flutter/material.dart';

import '../../../../Components/App_Theme/text_styles.dart';
import '../../../../components/app_theme/misc.dart';

class MgtTab extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const MgtTab({super.key, 
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? cs.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(appRadius),
            border: isSelected
                ? Border.all(color: cs.outlineVariant, width: 0.5)
                : null,
          ),
          child: Text(
            label,
            style: myMainTextStyle(context).copyWith(
              fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
              color: isSelected ? cs.primary : cs.onSurfaceVariant,
            ),
          ),
        ),
      ),
    );
  }
}
