import 'package:flutter/material.dart';
import 'package:hr_phelo/components/app_theme/padding.dart';
import 'package:hr_phelo/components/app_widgets/cards/stat_card.dart';

class EmployeeDataSummary extends StatefulWidget {
  const EmployeeDataSummary({super.key});

  @override
  State<EmployeeDataSummary> createState() => _EmployeeDataSummaryState();
}

class _EmployeeDataSummaryState extends State<EmployeeDataSummary>
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

  @override
  Widget build(BuildContext context) {
    final modules = [StatCard(), StatCard(), StatCard(), StatCard()];
    return Padding(
      padding: menuItemPadding,
      child: LayoutBuilder(
        builder: (context, constraints) {
          int crossCount = 1;
          double aspectRatio = 1 / 0.70;

          if (constraints.maxWidth > 1100) {
            crossCount = 4;
            aspectRatio = 1 / 0.4;
          } else if (constraints.maxWidth > 600) {
            crossCount = 2;
            aspectRatio = 1 / 0.55;
          }
          return GridView.builder(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossCount,
              childAspectRatio: aspectRatio,
            ),
            itemBuilder: (context, index) {
              final delay = index * 0.2;
              final anim =
                  Tween<Offset>(
                    begin: const Offset(0, 0.20),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(
                      parent: _controller,
                      curve: Interval(
                        delay.clamp(0.0, 1.0),
                        1.0,
                        curve: Curves.easeInOutCubicEmphasized,
                      ),
                    ),
                  );

              return FadeTransition(
                opacity: _controller,
                child: SlideTransition(position: anim, child: modules[index]),
              );
            },
            itemCount: modules.length,
          );
        },
      ),
    );
  }
}
