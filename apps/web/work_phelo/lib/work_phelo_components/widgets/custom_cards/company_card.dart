import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_components/widgets/form_components/app_buttons.dart';

import '../../../work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import '../../theme/app_padding.dart';
import '../../theme/app_text_theme.dart';
import '../../theme/miscellaneouse.dart';
import 'display_card.dart';

class CompanyDetailCard extends StatefulWidget {
  final CompanyModel company;
  final VoidCallback onEdit;
  final VoidCallback onAdminEdit;
  const CompanyDetailCard({
    super.key,
    required this.company,
    required this.onEdit,
    required this.onAdminEdit,
  });

  @override
  State<CompanyDetailCard> createState() => _CompanyDetailCardState();
}

class _CompanyDetailCardState extends State<CompanyDetailCard> {
  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);

    return DisplayCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left panel — logo + name + domain
          Container(
            width: 220,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cs.surfaceContainerLow,
              borderRadius: BorderRadius.circular(appRadius),
              border: Border.all(color: cs.outline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.max,
              children: [
                Padding(padding: space),
                CircleAvatar(
                  radius: 52,
                  backgroundColor: cs.primaryContainer,
                  child: Text(
                    widget.company.companyName
                        .trim()
                        .split(' ')
                        .map((e) => e[0])
                        .take(2)
                        .join(),
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: cs.onPrimaryContainer,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  widget.company.companyName,
                  textAlign: TextAlign.left,
                  style: myMainTextStyle(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700, color: cs.onSurface),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.company.companyDomain,
                  textAlign: TextAlign.center,
                  style: myNoInfoStyle(
                    context,
                  ).copyWith(color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.company.tenantSlug,
                  textAlign: TextAlign.center,
                  style: myNoInfoStyle(
                    context,
                  ).copyWith(color: cs.onSurfaceVariant),
                ),
                Spacer(),
                MyOutlinedMenuButton(
                  onPressed: widget.onEdit,
                  btnText: 'Edit',
                  btnIcon: UniconsLine.edit_alt,
                  btnAccent: ColorScheme.of(context).primary,
                  isHovered: true,
                ),
              ],
            ),
          ),

          const SizedBox(width: 24),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              // mainAxisSize: MainAxisSize.min,
              children: [
                _sectionHeader(context, 'Company information'),
                const SizedBox(height: 7),
                Row(
                  children: [
                    _infoColumn(
                      context,
                      'Company Size',
                      widget.company.companySize ?? '-',
                    ),
                    _infoColumn(
                      context,
                      'Industry',
                      widget.company.companyIndustry ?? '-',
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    _infoColumn(
                      context,
                      'Location',
                      widget.company.companyLocation ?? '-',
                    ),
                    _infoColumn(
                      context,
                      'Country',
                      widget.company.companyCountry ?? '-',
                    ),
                  ],
                ),
                // Administrator Information
                _sectionHeader(context, 'Administrator Information'),
                const SizedBox(height: 7),
                Row(
                  children: [
                    _infoColumn(context, 'Name', widget.company.adminName),
                    _infoColumn(context, 'Email', widget.company.adminEmail),
                  ],
                ),
                const SizedBox(height: 4),
                _infoColumn(
                  context,
                  'Contact',
                  widget.company.adminContact ?? '-',
                ),

                MySecButton(
                  btnText: 'Assign Administrator',
                  btnOnPressed: widget.onAdminEdit,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoColumn(BuildContext context, String label, String value) {
    final cs = Theme.of(context).colorScheme;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: myNoInfoStyle(
              context,
            ).copyWith(fontWeight: FontWeight.w600, color: cs.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, String title) {
    return Padding(
      padding: space,
      child: Text(
        title.toUpperCase(),
        style: myMainTextStyle(context).copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}
