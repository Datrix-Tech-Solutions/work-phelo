import 'package:flutter/material.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_phelo_navigation/hr_phelo_layout.dart';
import 'package:hr_phelo/components/app_widgets/cards/menu_card.dart';
import 'package:unicons/unicons.dart';

class ModuleOptions extends StatefulWidget {
  const ModuleOptions({super.key});

  @override
  State<ModuleOptions> createState() => _ModuleOptionsState();
}

class _ModuleOptionsState extends State<ModuleOptions>
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
    final modules = [
      MenuCard(
        onLaunch: () {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => HrPheloLayout()),
          );
        },
        accentColor: Colors.teal,
        icon: UniconsLine.icons,
        moduleName: 'Human Resource Platform',
        description:
            'Manage your workforce end-to-end -- employees, payroll, leave, onboarding, time tracking, and more',
        infoItems: [
          'Employee Managent',
          'Ghana payroll',
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
      MenuCard(
        onLaunch: () {},
        accentColor: Colors.green,
        icon: UniconsLine.icons,
        moduleName: 'Accounting Platform',
        description: 'description',
        infoItems: ['Employee Managent', 'Ghana payroll'],
        dataItems: [
          (title: 'Modules', subtitle: '10'),
          (title: 'SSNIT & PAYE', subtitle: '10'),
          (title: 'Status', subtitle: 'Live'),
        ],
      ),
      MenuCard(
        onLaunch: () {},
        accentColor: Colors.purpleAccent,
        icon: UniconsLine.icons,
        moduleName: 'Marketing Platform',
        description:
            'Manage your workforce end-to-end -- employees, payroll, leave, onboarding, time tracking, and more',
        infoItems: [
          'Employee Managent',
          'Ghana payroll',
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
      MenuCard(
        onLaunch: () {},
        accentColor: Colors.blue,
        icon: UniconsLine.icons,
        moduleName: 'Operations Platform',
        description: 'description',
        infoItems: ['Employee Managent', 'Ghana payroll'],
        dataItems: [
          (title: 'Modules', subtitle: '10'),
          (title: 'SSNIT & PAYE', subtitle: '10'),
          (title: 'Status', subtitle: 'Live'),
        ],
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        int crossCount = 1;
        double aspectRatio = 1 / 0.70;

        if (constraints.maxWidth > 1100) {
          crossCount = 2;
          aspectRatio = 1 / 0.5;
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
    );
  }
}
