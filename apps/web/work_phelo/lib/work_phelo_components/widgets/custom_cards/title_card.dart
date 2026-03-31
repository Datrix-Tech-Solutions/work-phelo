import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_modules/hr_phelo/hr_pages/employee_management/employees/employee_page_wigets.dart/employee_forms/onboarding_form.dart';

import '../../../apps/super_admin/super_admin_widgets/company_onboarded_list.dart';
import '../../../work_phelo_funtions/work_phelo_companies/employee_onboarding_functions/employee_onboarding_model.dart';
import '../../../work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import '../../theme/app.colors.dart';
import '../../theme/app_padding.dart';
import '../../theme/app_text_theme.dart';
import '../../theme/miscellaneouse.dart';
import '../form_components/app_buttons.dart';

class TitleCardStat {
  final String title;
  final String value;
  const TitleCardStat({required this.title, required this.value});
}

class TitleCard extends StatelessWidget {
  final String companyName;
  final String introText;
  final List<TitleCardStat> stats;

  const TitleCard({
    super.key,
    required this.introText,
    required this.companyName,
    this.stats = const [],
  });

  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);

    return Padding(
      padding: formPadding,
      child: Container(
        padding: myDisplayContentPadding,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [myMainColor, Colors.blue],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(appRadius),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 720;

            return isWide
                ? Row(
                    children: [
                      Expanded(child: _intro(context, cs)),
                      if (stats.isNotEmpty) _statsRow(context, cs),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _intro(context, cs),
                      if (stats.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        _statsRow(context, cs),
                      ],
                    ],
                  );
          },
        ),
      ),
    );
  }

  Widget _intro(BuildContext context, ColorScheme cs) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(
        companyName,
        style: myMainTextStyle(context).copyWith(color: Colors.amber[900]),
      ),
      subtitle: Text(
        introText,
        style: myTitleTextStyle(context).copyWith(color: cs.surface),
      ),
    );
  }

  Widget _statsRow(BuildContext context, ColorScheme cs) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: stats.map((s) => _StatTile(stat: s, cs: cs)).toList(),
    );
  }
}

class _StatTile extends StatelessWidget {
  final TitleCardStat stat;
  final ColorScheme cs;

  const _StatTile({required this.stat, required this.cs});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(
          stat.title,
          style: myNoInfoStyle(context).copyWith(color: cs.surface),
        ),
        subtitle: Text(
          stat.value,
          style: myMainTextStyle(context).copyWith(color: cs.surface),
        ),
      ),
    );
  }
}

class WelcomeCard extends StatefulWidget {
  final String date;
  final String welcomeText;

  const WelcomeCard({super.key, required this.welcomeText, required this.date});

  @override
  State<WelcomeCard> createState() => _WelcomeCardState();
}

class _WelcomeCardState extends State<WelcomeCard> {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: menuItemPadding,
      child: Container(
        padding: myDisplayContentPadding,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [myMainColor, Colors.blue],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(appRadius),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 3,
              child: ListTile(
                title: Text(
                  widget.welcomeText,
                  style: myTitleTextStyle(
                    context,
                  ).copyWith(color: ColorScheme.of(context).surface),
                ),
                subtitle: Text(
                  widget.date,
                  style: myMainTextStyle(
                    context,
                  ).copyWith(color: Colors.amber[500]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WelcomeCardAlt extends StatefulWidget {
  final String details;
  final String title;

  const WelcomeCardAlt({super.key, required this.title, required this.details});

  @override
  State<WelcomeCardAlt> createState() => _WelcomeCardAltState();
}

class _WelcomeCardAltState extends State<WelcomeCardAlt> {
  @override
  Widget build(BuildContext context) {
    ColorScheme.of(context);
    return Padding(
      padding: myDisplayContentPadding,
      child: Center(
        child: ListTile(
          title: Text(
            widget.title,
            style: myTitleTextStyle(
              context,
            ).copyWith(color: ColorScheme.of(context).onSurface),
          ),
          subtitle: Text(widget.details, style: myMainTextStyle(context)),
        ),
      ),
    );
  }
}

class CompanyCard extends StatelessWidget {
  final CompanyModel company;
  final VoidCallback onDelete;
  final VoidCallback onToggleStatus;

  const CompanyCard({
    super.key,
    required this.company,
    required this.onDelete,
    required this.onToggleStatus,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isActive = company.status == CompanyStatus.active;

    return Padding(
      padding: myContentPadding,
      child: Container(
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: BorderRadius.circular(appRadius),
          border: Border.all(color: cs.outline.withAlpha(70)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            // Left — company info
            Expanded(
              child: ListTile(
                title: Row(
                  children: [
                    Text(
                      company.companyName,
                      style: myMainTextStyle(context).copyWith(
                        fontWeight: FontWeight.w700,
                        color: cs.onSurface,
                      ),
                    ),
                    buildStatusChip(context, company.status),
                  ],
                ),
                subtitle: Text(
                  company.tenantSlug,
                  style: myNoInfoStyle(
                    context,
                  ).copyWith(color: cs.onSurfaceVariant),
                ),
              ),
            ),

            // Right — actions
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                MyOutlinedMenuButton(
                  onPressed: onDelete,
                  btnText: 'Delete Company',
                  btnIcon: UniconsLine.trash,
                  btnAccent: Colors.redAccent,
                  isHovered: false,
                ),
                const SizedBox(width: 10),
                MyOutlinedMenuButton(
                  onPressed: onToggleStatus,
                  btnText: isActive ? 'Deactivate' : 'Activate',
                  btnIcon: isActive ? UniconsLine.pen : UniconsLine.check,
                  btnAccent: myMainColor,
                  isHovered: true,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class EmployeeWelcomeCard extends StatelessWidget {
  final EmployeeModel employee;
  final VoidCallback onOffboard;
  final VoidCallback onEdit;

  const EmployeeWelcomeCard({
    super.key,
    required this.employee,
    required this.onOffboard,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    // final isActive = employee.status == EmployeeStatus.active;

    return Padding(
      padding: myContentPadding,
      child: Container(
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: BorderRadius.circular(appRadius),
          border: Border.all(color: cs.outline.withAlpha(70)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            // Left — company info
            Expanded(
              child: ListTile(title: sectionHeader(context, employee.fullName)),
            ),

            // Right — actions
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                MyOutlinedMenuButton(
                  onPressed: onOffboard,
                  btnText: 'Off-Board',
                  btnIcon: UniconsLine.user_times,
                  btnAccent: myMainColor,
                  isHovered: false,
                ),
                const SizedBox(width: 10),
                MyOutlinedMenuButton(
                  onPressed: onEdit,
                  btnText: 'Edit',
                  btnIcon: UniconsLine.pen,
                  btnAccent: myMainColor,
                  isHovered: true,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
