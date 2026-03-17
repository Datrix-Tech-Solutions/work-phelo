import 'package:flutter/material.dart';
import 'package:hr_phelo/components/app_theme/app_images.dart';
import 'package:hr_phelo/pages/dashboard/dashboard.dart';
import 'package:unicons/unicons.dart';

import '../../../Components/app_theme/colors.dart';
import 'hr_phelo_navigation.dart';
import 'hr_phelo_sidebar.dart';

class HrPheloLayout extends StatefulWidget {
  const HrPheloLayout({super.key});

  @override
  State<HrPheloLayout> createState() => _HrPheloLayoutState();
}

class _HrPheloLayoutState extends State<HrPheloLayout> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final currentPage = navigationItems
        .whereType<NavDestination>()
        .firstWhere(
          (item) => item.pageIndex == _currentIndex,
          orElse: () => navigationItems.whereType<NavDestination>().first,
        )
        .page;
    return Scaffold(
      appBar: AppBar(
        leadingWidth: 150,
        backgroundColor: ColorScheme.of(context).surface,
        leading: appLogo,

        actions: [
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.notifications_none, color: myMainColor),
          ),
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
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => DashboardPage()),
              );
            },
            icon: Icon(UniconsLine.apps, color: myMainColor),
          ),
          // IconButton(
          //   onPressed: () {
          //     Navigator.pushNamedAndRemoveUntil(
          //       context,
          //       '/login',
          //       (route) => false,
          //     );
          //   },
          //   icon: Icon(UniconsLine.user_circle, color: myMainColor),
          // ),
          Padding(padding: EdgeInsets.all(10)),
        ],
      ),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppSidebar(
            currentIndex: _currentIndex,
            onDestinationSelected: (index) {
              setState(() => _currentIndex = index);
            },
          ),
          Expanded(child: currentPage),
        ],
      ),
    );
  }
}
