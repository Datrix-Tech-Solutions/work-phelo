import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';

import '../../../pages/log_out/logout_confirmation_popup.dart';
import '../../../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import '../../theme/miscellaneouse.dart';
import '../custom_lists/navigation.dart';
import '../custom_lists/navigation_tile.dart';

class AppSidebar extends ConsumerWidget {
  final List<NavItem> navigationItems;
  final int currentIndex;
  final ValueChanged<int> onDestinationSelected;
  final bool isCompact;
  final Widget? header;
  final VoidCallback onToggleCompact;

  static final _logoutDestination = NavDestination(
    title: 'Sign out',
    icon: UniconsLine.sign_out_alt,
    pageIndex: -1,
    page: const SizedBox.shrink(),
  );

  const AppSidebar({
    super.key,
    required this.navigationItems,
    required this.currentIndex,
    required this.onDestinationSelected,
    this.isCompact = false,
    this.header,
    required this.onToggleCompact,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    ref.listen<AuthenticationState>(authNotifierProvider, (previous, next) {
      if (previous?.isAuthenticated == true && !next.isAuthenticated) {
        Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
      }
    });

    return Material(
      color: colorScheme.surface,
      elevation: 1,
      child: SizedBox(
        width: isCompact ? 72 : 260,
        child: Column(
          children: [
            SizedBox(
              height: 56,
              child: Row(
                children: [
                  if (!isCompact && header != null)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 16),
                        child: header!,
                      ),
                    ),
                  if (isCompact) const Spacer(),
                  IconButton(
                    onPressed: onToggleCompact,
                    icon: Icon(
                      isCompact
                          ? Icons.keyboard_arrow_right_rounded
                          : Icons.keyboard_arrow_left_rounded,
                      color: colorScheme.onSurfaceVariant,
                    ),
                    tooltip: isCompact ? 'Expand' : 'Collapse',
                  ),
                ],
              ),
            ),
            // Header / Logo area (optional)
            if (header != null) ...[
              Padding(padding: const EdgeInsets.all(16), child: header),
              const Divider(height: 1),
            ],

            // Navigation list
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: navigationItems.length,
                itemBuilder: (context, index) {
                  final item = navigationItems[index];

                  if (item is NavSection) {
                    if (isCompact) return const SizedBox.shrink();

                    return Padding(
                      padding: const EdgeInsets.fromLTRB(20, 6, 16, 6),
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
                      destination: item,
                      isSelected: isSelected,
                      onTap: () => onDestinationSelected(item.pageIndex),
                      showLabel: !isCompact,
                      isCompact: isCompact,
                    );
                  }

                  return const SizedBox.shrink();
                },
              ),
            ),
            myDivider(context),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: navigationTile(
                context: context,
                destination: _logoutDestination,
                isSelected: false,
                isCompact: isCompact,
                showLabel: !isCompact,
                onTap: () => logoutConfirmationPopup(context, ref),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
