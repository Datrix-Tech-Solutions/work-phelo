import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../work_phelo_components/widgets/custom_cards/menu_card.dart';
import 'hr_phelo/hr_phelo_navigation/hr_phelo_layout.dart';

class ModuleOptions extends ConsumerStatefulWidget {
  // ← ConsumerStatefulWidget
  final AppUserModel currentUser;
  const ModuleOptions({super.key, required this.currentUser});

  @override
  ConsumerState<ModuleOptions> createState() => _ModuleOptionsState();
}

class _ModuleOptionsState extends ConsumerState<ModuleOptions>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

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

  // Resolve which modules this user's company has enabled
  List<String> _enabledModules() {
    // super_admin sees everything
    if (widget.currentUser.isSuperAdmin) {
      return ['hr', 'accounting', 'marketing', 'operations'];
    }

    final company = ref.watch(
      companyBySlugProvider(widget.currentUser.tenantSlug),
    );

    // platform_owner or employee — use company config
    return company?.enabledModules ?? [];
  }

  @override
  Widget build(BuildContext context) {
    final double cardWidth = MediaQuery.sizeOf(context).width * 0.47;
    final enabled = _enabledModules();

    Widget hrCard() => SizedBox(
      width: cardWidth,
      child: MenuCard(
        onLaunch: enabled.contains('hr')
            ? () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) =>
                        HrPheloLayout(currentUser: widget.currentUser),
                  ),
                );
              }
            : () {}, // no-op when disabled
        isEnabled: enabled.contains('hr'),
        accentColor: Colors.teal,
        icon: UniconsLine.user_circle,
        moduleName: 'Human Resource Platform',
        description:
            'Manage your workforce end-to-end — employees, payroll, leave, onboarding, time tracking, and more',
        infoItems: [
          'Employee Management',
          'Ghana Payroll',
          'Leave and Attendance',
          'Time Clock',
          'Onboarding',
          'Asset Tracking',
        ],
        dataItems: [
          (title: 'Modules', subtitle: '10'),
          (title: 'SSNIT & PAYE', subtitle: '10'),
          (title: 'Status', subtitle: 'Live'),
        ],
      ),
    );

    Widget marketingCard() => SizedBox(
      width: cardWidth,
      child: MenuCard(
        onLaunch: () {},
        isEnabled: enabled.contains('marketing'),
        accentColor: Colors.purpleAccent,
        icon: UniconsLine.monitor,
        moduleName: 'Marketing Platform',
        description:
            'Full double-entry accounting, financial statements, tax compliance, and real-time cash flow tracking',
        infoItems: [
          'Employee Management',
          'Ghana Payroll',
          'Leave and Attendance',
          'Time Clock',
          'Onboarding',
          'Asset Tracking',
        ],
        dataItems: [
          (title: 'Modules', subtitle: '10'),
          (title: 'SSNIT & PAYE', subtitle: '10'),
          (title: 'Status', subtitle: 'Live'),
        ],
      ),
    );

    Widget operationsCard() => SizedBox(
      width: cardWidth,
      child: MenuCard(
        onLaunch: () {},
        isEnabled: enabled.contains('operations'),
        accentColor: Colors.red,
        icon: UniconsLine.shield_check,
        moduleName: 'Operations',
        description:
            'Streamline your operations - Inventory management, supplier relationships, procurement and logistics',
        infoItems: [
          'Inventory control',
          'Purchase Orders',
          'Supplier Management',
          'Warehouse (WMS)',
          'Logistics Tracking',
          'Demand Planning',
        ],
        dataItems: [
          (title: 'Modules', subtitle: '10'),
          (title: 'SSNIT & PAYE', subtitle: '10'),
          (title: 'Status', subtitle: 'Live'),
        ],
      ),
    );

    Widget accountingCard() => SizedBox(
      width: cardWidth,
      child: MenuCard(
        onLaunch: () {},
        isEnabled: enabled.contains('accounting'),
        accentColor: Colors.blue,
        icon: UniconsLine.comparison,
        moduleName: 'Accounting Platform',
        description:
            'Full double-entry accounting, financial statements, tax compliance, and real-time cash flow tracking.',
        infoItems: [
          'General Ledger',
          'Invoicing & Billing',
          'Expense Tracking',
          'Tax Returns',
          'Financial Reports',
          'Bank Reconciliation',
        ],
        dataItems: [
          (title: 'Modules', subtitle: '10'),
          (title: 'SSNIT & PAYE', subtitle: '10'),
          (title: 'Status', subtitle: 'Live'),
        ],
      ),
    );

    return Center(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(children: [hrCard(), marketingCard()]),
            Wrap(children: [accountingCard(), operationsCard()]),
          ],
        ),
      ),
    );
  }
}
