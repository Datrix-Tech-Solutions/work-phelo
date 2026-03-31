import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../pages/log_out/user_details_popup.dart';
import '../../work_phelo_components/theme/app.colors.dart';
import '../../work_phelo_components/theme/app_images.dart';
import '../../work_phelo_components/widgets/custom_lists/horizontal_nav_bar.dart';
import '../../work_phelo_components/widgets/misc/user_avator.dart';
import '../../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import 'super_admin_pages/company_details_page.dart';
import 'super_admin_pages/super_admin_portal.dart';

class SuperAdminLayout extends ConsumerStatefulWidget {
  const SuperAdminLayout({super.key});

  @override
  ConsumerState<SuperAdminLayout> createState() => _SuperAdminLayoutState();
}

class _SuperAdminLayoutState extends ConsumerState<SuperAdminLayout> {
  int _currentIndex = 0;
  CompanyModel? _selectedCompany;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    if (!authState.isAuthenticated || authState.user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/platform/login');
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final user = authState.user!;

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 150,
        backgroundColor: ColorScheme.of(context).surface,
        leading: appLogo,
        title: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AppNavItem(
              label: 'Portal',
              icon: UniconsLine.home_alt,
              isSelected: _currentIndex == 0,
              onTap: () => setState(() => _currentIndex = 0),
            ),
            AppNavItem(
              label: 'Reports',
              icon: UniconsLine.chart_bar,
              isSelected: _currentIndex == 1,
              onTap: () => setState(() => _currentIndex = 1),
            ),
            AppNavItem(
              label: 'Support',
              icon: UniconsLine.question_circle,
              isSelected: _currentIndex == 2,
              onTap: () => setState(() => _currentIndex = 2),
            ),
          ],
        ),
        actions: [
          IconButton(onPressed: () {}, icon: Icon(Icons.notifications_none, color: myMainColor)),
          IconButton(onPressed: () {}, icon: Icon(UniconsLine.setting, color: myMainColor)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: UserDashIcon(
              onIconPressed: (details) {
                UserDetailsPopup.show(context, details.globalPosition, user, ref);
              },
              initials: user.fullName.isNotEmpty
                  ? user.fullName.trim().split(' ').map((e) => e[0]).take(2).join()
                  : 'G',
            ),
          ),
          const Padding(padding: EdgeInsets.all(10)),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _portalPage(user),
          const Center(child: Text('Reports')),
          const Center(child: Text('Support')),
        ],
      ),
    );
  }

  Widget _portalPage(AppUserModel user) {
    return _selectedCompany == null
        ? Center(
            child: SuperAdminPortal(
              onCompanySelected: (company) => setState(() => _selectedCompany = company),
            ),
          )
        : CompanyDetailPage(
            company: _selectedCompany!,
            onBack: () => setState(() => _selectedCompany = null),
          );
  }
}