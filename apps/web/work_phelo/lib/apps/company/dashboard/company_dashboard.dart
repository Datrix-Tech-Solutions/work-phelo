import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../work_phelo_modules/module_options.dart';
import '../../../pages/log_out/user_details_popup.dart';
import '../../../work_phelo_components/theme/app.colors.dart';
import '../../../work_phelo_components/theme/app_images.dart';
import '../../../work_phelo_components/theme/miscellaneouse.dart';
import '../../../work_phelo_components/widgets/custom_cards/title_card.dart';
import '../../../work_phelo_components/widgets/custom_lists/horizontal_nav_bar.dart';
import '../../../work_phelo_components/widgets/misc/user_avator.dart';
import '../../../work_phelo_funtions/work_phelo_companies/company_asset_management_functions/company_asset_state.dart';
import '../company_pages/management_pages/management_page_layout.dart';
import '../company_pages/management_pages/permissions_roles_pages/roles_permissions_page.dart';
import '../company_pages/management_pages/tmp_pages.dart';

class CompanyDashboard extends ConsumerStatefulWidget {
  const CompanyDashboard({super.key});

  @override
  ConsumerState<CompanyDashboard> createState() => _CompanyDashboardState();
}

class _CompanyDashboardState extends ConsumerState<CompanyDashboard> {
  int _currentIndex = 1;
  int _managementSubIndex = -1;
  String statDisplay(String value) => value == '0' ? '-' : value;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.user;

    if (user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {});
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    ref.listen<AuthenticationState>(authNotifierProvider, (previous, next) {
      if (previous?.isAuthenticated == true && !next.isAuthenticated) {}
    });

    final users = ref.watch(usersByTenantProvider(user.tenantSlug));
    final assetCount = ref.watch(tenantAssetsCountProvider(user.tenantSlug));

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
              label: 'Modules',
              icon: UniconsLine.apps,
              isSelected: _currentIndex == 1,
              onTap: () => setState(() => _currentIndex = 1),
            ),
            AppNavItem(
              label: 'Management',
              icon: UniconsLine.building,
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
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: InkWell(
              onTap: () => context.go('/${user.tenantSlug}/login'),
              borderRadius: BorderRadius.circular(appRadius),
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
          ),
          const Padding(padding: EdgeInsets.all(10)),
        ],
      ),
      body: Column(
        children: [
          TitleCard(
            companyName: user.companyName,
            introText: 'Good morning, ${user.fullName}',
            stats: [
              TitleCardStat(
                title: 'Employees',
                value: statDisplay(users.length.toString()),
              ),
              TitleCardStat(
                title: 'On Leave',
                value: statDisplay(
                  users
                      .where((u) => u.status == EmploymentStatus.onLeave)
                      .length
                      .toString(),
                ),
              ),
              TitleCardStat(
                title: 'Active Employees',
                value: statDisplay(
                  ref
                      .watch(userProvider)
                      .users
                      .where((u) => u.status == EmploymentStatus.active)
                      .length
                      .toString(),
                ),
              ),
              TitleCardStat(
                title: 'Company Assets',
                value: statDisplay(assetCount.toString()),
              ),
            ],
          ),
          Expanded(
            child: IndexedStack(
              index: _currentIndex,
              children: [
                const Center(child: Text('Home Page')),
                ModuleOptions(), // ← No currentUser
                _managementPage(user),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _managementPage(AppUserModel user) {
    return _managementSubIndex == -1
        ? ManagementPage(
            onNavigate: (i) => setState(() => _managementSubIndex = i),
          )
        : _managementSubPages(user)[_managementSubIndex];
  }

  List<Widget> _managementSubPages(AppUserModel user) => [
    AdminAcc(),
    Employees(onBack: () => setState(() => _managementSubIndex = -1)),
    RolesPermissionsPage(
      onBack: () => setState(() => _managementSubIndex = -1),
      currentUser: user,
    ),
    const AdminAcc(),
    const AuditLog(),
    const GeneralSettings(),
  ];
}
