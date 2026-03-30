import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../pages/log_out/user_details_popup.dart';
import '../../work_phelo_components/theme/app.colors.dart';
import '../../work_phelo_components/theme/app_images.dart';
import '../../work_phelo_components/widgets/custom_lists/horizontal_nav_bar.dart';
import '../../work_phelo_components/widgets/misc/user_avator.dart';
import 'super_admin_pages/company_details_page.dart';
import 'super_admin_pages/super_admin_portal.dart';

class SuperAdminLayout extends ConsumerStatefulWidget {
  const SuperAdminLayout({super.key});

  @override
  ConsumerState<SuperAdminLayout> createState() => _SuperAdminLayoutState();
}

class _SuperAdminLayoutState extends ConsumerState<SuperAdminLayout> {
  late AppUserModel user;
  int _currentIndex = 0;
  CompanyModel? _selectedCompany;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is AppUserModel) {
      user = args;
    } else {
      user = AppUserModel(
        uid: '',
        email: '',
        fullName: '',
        role: 'guest',
        companyName: '',
        tenantSlug: '',
        companyStatus: '',
        lastLogin: DateTime.now(),
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          Navigator.pushNamedAndRemoveUntil(
            context,
            '/login',
            (route) => false,
          );
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
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
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.notifications_none, color: myMainColor),
          ),

          IconButton(
            onPressed: () {},
            icon: Icon(UniconsLine.setting, color: myMainColor),
          ),

          Padding(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: UserDashIcon(
              onIconPressed: (details) {
                UserDetailsPopup.show(
                  context,
                  details.globalPosition,
                  user,
                  ref,
                );
              },
              initials: user.fullName.isNotEmpty
                  ? user.fullName
                        .trim()
                        .split(' ')
                        .map((e) => e[0])
                        .take(2)
                        .join()
                  : 'G',
            ),
          ),

          Padding(padding: EdgeInsets.all(10)),
        ],
      ),
      body: // In Scaffold body:
      IndexedStack(
        index: _currentIndex,
        children: [_portalPage(), _reportsPage(), _supportsPage()],
      ),
    );
  }

  Widget _portalPage() {
    return _selectedCompany == null
        ? Center(
            child: SuperAdminPortal(
              currentUser: user,
              onCompanySelected: (company) =>
                  setState(() => _selectedCompany = company),
            ),
          )
        : CompanyDetailPage(
            company: _selectedCompany!,
            currentUser: user,
            onBack: () => setState(() => _selectedCompany = null),
          );
  }

  Widget _reportsPage() {
    return const Center(child: Text('Reports'));
  }

  Widget _supportsPage() {
    return const Center(child: Text('Support'));
  }
}
