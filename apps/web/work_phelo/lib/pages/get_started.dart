import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_permission_funtions/employee_roles_models.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';

import '../work_phelo_components/theme/app_images.dart';
import '../work_phelo_components/theme/app_text_theme.dart';
import '../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';

class GetStartedPage extends ConsumerWidget {
  const GetStartedPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;

    // Safety guard
    if (currentUser == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final slug = currentUser?.tenantSlug;
if (slug != null && slug.isNotEmpty) {
  context.go('/$slug/login');
} else {
  context.go('/platform/login');
}
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Welcome to'),
                appLogo,
                Text(
                  currentUser.companyName,
                  style: myLargeTextStyle(context),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'Your workspace is ready. Let\'s get everything set up.',
                  style: myMainTextStyle(context).copyWith(
                    color: ColorScheme.of(context).onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),
                MyButton(
                  btnText: 'Get started',
                  btnOnPressed: () {
                    // Activate the company
                    ref.read(companyProvider.notifier).setActive(currentUser.tenantSlug);
                    seedRoles(ref, currentUser.tenantSlug);

                    context.go('/tenant/dashboard');
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}