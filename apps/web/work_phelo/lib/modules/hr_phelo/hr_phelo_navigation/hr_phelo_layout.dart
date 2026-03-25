import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../Components/app_theme/colors.dart';
import '../../../components/app_theme/app_images.dart';
import '../../../components/app_theme/text_styles.dart';
import '../../../components/app_widgets/lists/navigation.dart';
import '../../../apps/company/dashboard/company_dashboard.dart';
import '../../dashboard.dart';
import 'hr_phelo_navigation.dart';
import '../../../components/app_widgets/app_sidebar.dart';

class HrPheloLayout extends ConsumerStatefulWidget {
  final AppUser currentUser;
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
