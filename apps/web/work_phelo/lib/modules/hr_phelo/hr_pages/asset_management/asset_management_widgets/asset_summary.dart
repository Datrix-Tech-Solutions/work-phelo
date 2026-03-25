import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../../components/app_widgets/cards/stat_card.dart';

class AssetSummary extends StatefulWidget {
  const AssetSummary({super.key});

  @override
  State<AssetSummary> createState() => _AssetSummaryState();
}

class _AssetSummaryState extends State<AssetSummary>
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
    final stats = [
      {
        'title': 'Total Assets',
        'value': '-',
        'icon': UniconsLine.monitor,
        'color': Colors.blue,
      },
      {
        'title': 'Available',
        'value': '-',
        'icon': UniconsLine.check_circle,
        'color': Colors.green,
      },
      {
        'title': 'Assigned',
        'value': '-',
        'icon': UniconsLine.desktop_alt_slash,
        'color': Colors.yellow,
      },
      {
        'title': 'Maintenance',
        'value': '-',
        'icon': UniconsLine.wrench,
        'color': Colors.deepOrange,
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
