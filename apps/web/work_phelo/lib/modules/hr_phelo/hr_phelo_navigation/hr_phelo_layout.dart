import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:unicons/unicons.dart';
import '../../../work_phelo_components/theme/app.colors.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/custom_lists/navigation.dart';
import '../../../work_phelo_components/widgets/misc/app_sidebar.dart';
import '../../../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import 'hr_phelo_navigation.dart';

class HrPheloLayout extends ConsumerStatefulWidget {
  const HrPheloLayout({super.key});

  @override
  ConsumerState<HrPheloLayout> createState() => _HrPheloLayoutState();
}

class _HrPheloLayoutState extends ConsumerState<HrPheloLayout> {
  int _currentIndex = 0;
  bool _isCompact = false;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {});
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    ref.listen<AuthenticationState>(authNotifierProvider, (previous, next) {
      if (previous?.isAuthenticated == true && !next.isAuthenticated) {}
    });

    final accessibleModules = resolveUserModules(currentUser, ref);
    final navItems = hrNavigationItems(currentUser, accessibleModules);
    final destinations = navItems.whereType<NavDestination>().toList();
    final safeIndex = _currentIndex.clamp(0, destinations.length - 1);

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 150,
        backgroundColor: ColorScheme.of(context).surface,
        leading: appLogo,
        title: Text(currentUser.companyName, style: myTitleTextStyle(context)),
        actions: [
          IconButton(
            onPressed: () {},
            icon: Icon(UniconsLine.question_circle, color: myMainColor),
          ),
          IconButton(
            onPressed: () {},
            icon: Icon(UniconsLine.setting, color: myMainColor),
          ),
          IconButton(
            onPressed: () {
              if (currentUser.isPlatformOwner) {
                context.go('/tenant/dashboard');
              } else {
                context.go('/dashboard');
              }
            },
            icon: Icon(UniconsLine.apps, color: myMainColor),
          ),
          const SizedBox(width: 10),
        ],
      ),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppSidebar(
            navigationItems: navItems,
            currentIndex: _currentIndex,
            onDestinationSelected: (index) =>
                setState(() => _currentIndex = index),
            isCompact: _isCompact,
            onToggleCompact: () => setState(() => _isCompact = !_isCompact),
          ),
          Expanded(
            child: IndexedStack(
              index: safeIndex,
              children: destinations
                  .map((d) => d.page)
                  .whereType<Widget>()
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}
