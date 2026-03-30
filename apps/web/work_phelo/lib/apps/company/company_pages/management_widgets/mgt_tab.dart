import 'package:flutter/material.dart';

import '../../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../../work_phelo_components/theme/miscellaneouse.dart';

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
