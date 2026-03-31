import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:work_phelo/modules/dashboard.dart';
import 'package:work_phelo/modules/hr_phelo/hr_phelo_navigation/hr_phelo_layout.dart';

import '../apps/company/dashboard/company_dashboard.dart';
import '../apps/super_admin/super_admin_layout.dart';
import '../pages/get_started.dart';
import '../pages/login_page/login_pages/admin_login_page.dart';
import '../pages/login_page/login_pages/tenant_login_page.dart';

final goRouterProvider = Provider<GoRouter>((ref) => router);

final GoRouter router = GoRouter(
  initialLocation: '/platform/login',
  debugLogDiagnostics: true,
  routes: [
    GoRoute(
      path: '/platform/login',
      builder: (context, state) => const SuperAdminLoginPage(),
    ),
    GoRoute(
      path: '/platform/dashboard',
      builder: (context, state) => const SuperAdminLayout(),
    ),

    GoRoute(
      path: '/tenant/dashboard',
      builder: (context, state) => const CompanyDashboard(),
    ),
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const DashboardPage(),
    ),
    
    GoRoute(
      path: '/get-started',
      builder: (context, state) => const GetStartedPage(),
    ),
    // App page routes
    GoRoute(path: '/hr', builder: (context, state) => const HrPheloLayout()),
    GoRoute(
      path: '/:tenantSlug/login',
      builder: (context, state) {
        final tenantSlug = state.pathParameters['tenantSlug'] ?? '';
        return TenantLoginPage(tenantSlug: tenantSlug);
      },
    ),
  ],
);
