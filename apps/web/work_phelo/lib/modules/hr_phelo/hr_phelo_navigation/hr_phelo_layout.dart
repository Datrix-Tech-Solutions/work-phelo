import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../apps/company/dashboard/company_dashboard.dart';
import '../../../work_phelo_components/theme/app.colors.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/custom_lists/navigation.dart';
import '../../../work_phelo_components/widgets/misc/app_sidebar.dart';
import '../../dashboard.dart';
import 'hr_phelo_navigation.dart';

class HrPheloLayout extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
  const HrPheloLayout({super.key, required this.currentUser});

  @override
  ConsumerState<HrPheloLayout> createState() => _HrPheloLayoutState();
}

class _HrPheloLayoutState extends ConsumerState<HrPheloLayout> {
  int _currentIndex = 0;
  bool _isCompact = false;

  @override
  Widget build(BuildContext context) {
    final accessibleModules = resolveUserModules(widget.currentUser, ref);
    final navItems = hrNavigationItems(widget.currentUser, accessibleModules);
    final destinations = navItems.whereType<NavDestination>().toList();
    final safeIndex = _currentIndex.clamp(0, destinations.length - 1);

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 150,
        backgroundColor: ColorScheme.of(context).surface,
        leading: appLogo,
        title: Text(
          widget.currentUser.companyName,
          style: myTitleTextStyle(context),
        ),
        actions: [
          // IconButton(
          //   onPressed: () {},
          //   icon: Icon(Icons.notifications_none, color: myMainColor),
          // ),
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
              if (widget.currentUser.isPlatformOwner) {
                // Back to Company dashboard
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) => CompanyDashboard(),
                    settings: RouteSettings(
                      arguments: {
                        'user': widget.currentUser,
                        'initialIndex': 1,
                      },
                    ),
                  ),
                );
              } else {
                // Back to Employee dashboard
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) => DashboardPage(),
                    settings: RouteSettings(arguments: widget.currentUser),
                  ),
                );
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
