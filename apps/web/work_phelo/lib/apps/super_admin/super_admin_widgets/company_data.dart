import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';

import '../../../work_phelo_components/widgets/custom_cards/stats_card.dart';

class CompanyData extends ConsumerStatefulWidget {
  const CompanyData({super.key});

  @override
  ConsumerState<CompanyData> createState() => _CompanyDataState();
}

class _CompanyDataState extends ConsumerState<CompanyData>
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
    final state = ref.watch(companyProvider);
    final companies = state.companies;

    // Move these above the stats list
    final totalCompanies = companies.length;
    final activeCompanies = companies
        .where((c) => c.status == CompanyStatus.active)
        .length;
    final inactiveCompanies = companies
        .where((c) => c.status == CompanyStatus.inactive)
        .length;
    final currentMonth = DateTime.now().month;
    final currentYear = DateTime.now().year;
    final newThisMonth = companies.where((c) {
      final d = c.onboardedDate;
      return d != null && d.month == currentMonth && d.year == currentYear;
    }).length;
    final stats = [
      {
        'title': 'Total Companies Onboarded',
        'value': '$totalCompanies',
        'icon': UniconsLine.building,
        'color': Colors.blue,
      },
      {
        'title': 'Companies Active',
        'value': '$activeCompanies',
        'icon': UniconsLine.shield_check,
        'color': Colors.green,
      },
      {
        'title': 'Companies Inactive',
        'value': '$inactiveCompanies',
        'icon': UniconsLine.shield_slash,
        'color': Colors.redAccent,
      },

      {
        'title':
            'New Companies for ${DateFormat('MMMM').format(DateTime.now())}',
        'value': '$newThisMonth',
        'icon': UniconsLine.shield_plus,
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
