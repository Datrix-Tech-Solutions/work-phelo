import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';
import '../work_phelo_components/widgets/custom_cards/menu_card.dart';
import '../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';

class ModuleOptions extends ConsumerStatefulWidget {
  const ModuleOptions({super.key});

  @override
  ConsumerState<ModuleOptions> createState() => _ModuleOptionsState();
}

class _ModuleOptionsState extends ConsumerState<ModuleOptions>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  ///temporary by pass
  static const bool kDevBypassHR = true;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<String> _enabledModules() {
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser?.isSuperAdmin ?? false) {
      return ['hr', 'accounting', 'marketing', 'operations'];
    }

    final company = ref.watch(
      companyBySlugProvider(currentUser?.tenantSlug ?? ''),
    );
    return company?.enabledModules ?? [];
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final enabledModules = _enabledModules();

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          children: [
            Text(
              'Choose a Module',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 48),

            LayoutBuilder(
              builder: (context, constraints) {
                // Responsive crossAxisCount for Flutter Web
                final int crossCount = (constraints.maxWidth / 300)
                    .floor()
                    .clamp(1, 4);

                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(top: 8),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossCount,
                    crossAxisSpacing: 20,
                    mainAxisSpacing: 28,
                    mainAxisExtent: 250,
                  ),
                  itemCount: 4,
                  itemBuilder: (context, index) {
                    return _buildModuleCard(
                      index,
                      enabledModules,
                      constraints.maxWidth,
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  // Helper to keep code clean
  Widget _buildModuleCard(
    int index,
    List<String> enabledModules,
    double screenWidth,
  ) {
    switch (index) {
      case 0: // HR
        final bool hrEnabled = kDevBypassHR || enabledModules.contains('hr');
        return MenuCard(
          onLaunch: hrEnabled ? () => context.go('/hr') : () {},
          // onLaunch: enabledModules.contains('hr')
          //     ? () => context.go('/hr')
          //     : () {},
          isEnabled: hrEnabled,
          // isEnabled: enabledModules.contains('hr'),
          accentColor: Colors.teal,
          icon: UniconsLine.user_circle,
          moduleName: 'Human Resource',
          description: 'Manage employees, payroll, and attendance',
        );

      case 1: // Marketing
        return MenuCard(
          onLaunch: () {},
          isEnabled: enabledModules.contains('marketing'),
          accentColor: Colors.purpleAccent,
          icon: UniconsLine.monitor,
          moduleName: 'Marketing',
          description: 'Campaigns, leads, and customer engagement',
        );

      case 2: // Accounting
        return MenuCard(
          onLaunch: () {},
          isEnabled: enabledModules.contains('accounting'),
          accentColor: Colors.blue,
          icon: UniconsLine.comparison,
          moduleName: 'Accounting',
          description: 'Financial statements, tax & cash flow',
        );

      case 3: // Operations
        return MenuCard(
          onLaunch: () {},
          isEnabled: enabledModules.contains('operations'),
          accentColor: Colors.red,
          icon: UniconsLine.shield_check,
          moduleName: 'Operations',
          description: 'Inventory, suppliers & logistics',
        );

      default:
        return const SizedBox();
    }
  }
}
