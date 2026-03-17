import 'package:flutter/material.dart';

import '../../../components/app_widgets/lists/navigation_tile.dart';
import 'hr_phelo_navigation.dart';

class AppSidebar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onDestinationSelected;

  const AppSidebar({
    super.key,
    required this.currentIndex,
    required this.onDestinationSelected,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Material(
      color: colorScheme.surface,
      elevation: 1,
      child: SizedBox(
        width: 260,
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 16),
          itemCount: navigationItems.length,
          itemBuilder: (context, index) {
            final item = navigationItems[index];

            if (item is NavSection) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 16, 12),
                child: Text(
                  item.title.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                    color: colorScheme.onSurfaceVariant.withAlpha(70),
                  ),
                ),
              );
            }

            if (item is NavDestination) {
              final isSelected = currentIndex == item.pageIndex;

              return navigationTile(
                context: context,
                item: {'icon': item.icon, 'title': item.title},
                isSelected: isSelected,
                // index: index,
                onTap: () => onDestinationSelected(item.pageIndex),
                showLabel: true,
                isCompact: false,
              );
            }

            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}
