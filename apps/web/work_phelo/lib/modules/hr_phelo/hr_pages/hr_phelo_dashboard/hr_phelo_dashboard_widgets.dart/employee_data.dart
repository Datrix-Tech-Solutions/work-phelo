import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

import '../../../../../work_phelo_components/widgets/custom_cards/stats_card.dart';

class EmployeeDataSummary extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
  const EmployeeDataSummary({super.key, required this.currentUser});

  @override
  ConsumerState<EmployeeDataSummary> createState() =>
      _EmployeeDataSummaryState();
}

class _EmployeeDataSummaryState extends ConsumerState<EmployeeDataSummary>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final users = ref.watch(
      usersByTenantProvider(widget.currentUser.tenantSlug),
    );

    final stats = [
      {
        'title': 'Total Employees',
        'value': users.length.toString(),
        'icon': UniconsLine.users_alt,
        'color': Colors.blue,
      },
      {
        'title': 'Active Today',
        'value': users
            .where((u) => u.status == EmploymentStatus.active)
            .length
            .toString(),
        'icon': UniconsLine.check_circle,
        'color': Colors.green,
      },
      {
        'title': 'On Leave',
        'value': users
            .where((u) => u.status == EmploymentStatus.onLeave)
            .length
            .toString(),
        'icon': UniconsLine.history_alt,
        'color': Colors.orange,
      },
      {
        'title': 'Assets Assigned',
        'value': users
            .where((u) => u.asset != null && u.asset!.isNotEmpty)
            .length
            .toString(),
        'icon': UniconsLine.monitor,
        'color': Colors.purple,
      },
    ];

    final screenWidth = MediaQuery.sizeOf(context).width;
    final int crossCount = screenWidth >= 1024
        ? 4
        : screenWidth >= 600
        ? 2
        : 1;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: LayoutBuilder(
        builder: (context, constraints) {
          const double spacing = 20.0;
          final double cardWidth =
              (constraints.maxWidth - spacing * (crossCount - 1)) / crossCount;

          return Wrap(
            spacing: spacing,
            runSpacing: spacing,
            children: List.generate(stats.length, (index) {
              final delay = index * 0.15;

              final slideAnim =
                  Tween<Offset>(
                    begin: const Offset(0, 0.25),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(
                      parent: _controller,
                      curve: Interval(
                        delay.clamp(0.0, 0.8),
                        1.0,
                        curve: Curves.easeInOutCubicEmphasized,
                      ),
                    ),
                  );

              return FadeTransition(
                opacity: _controller,
                child: SlideTransition(
                  position: slideAnim,
                  child: SizedBox(
                    width: cardWidth,
                    child: StatCard(
                      title: stats[index]['title'] as String,
                      value: stats[index]['value'] as String,
                      icon: stats[index]['icon'] as IconData,
                      accentColor: stats[index]['color'] as Color,
                    ),
                  ),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}
