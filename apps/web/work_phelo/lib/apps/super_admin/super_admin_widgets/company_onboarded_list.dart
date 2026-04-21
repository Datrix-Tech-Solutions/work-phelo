import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';

import '../../../work_phelo_components/theme/app_text_theme.dart';

List<Widget> buildCompanyOnboardedRowCells(
  BuildContext context,
  CompanyModel company,
  WidgetRef ref, {
  required VoidCallback onTap,
}) {
  final cs = Theme.of(context).colorScheme;

  return [
    // Cell 1 — Employee
    Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              company.companyName,
              style: myMainTextStyle(
                context,
              ).copyWith(fontWeight: FontWeight.w600, color: cs.onSurface),
            ),
            Text(
              company.companyDomain,
              style: myNoInfoStyle(
                context,
              ).copyWith(color: cs.onSurfaceVariant),
            ),
          ],
        ),
      ],
    ),

    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          company.adminName,
          style: myMainTextStyle(
            context,
          ).copyWith(fontWeight: FontWeight.w600, color: cs.onSurface),
        ),
        Text(
          company.adminEmail,
          style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
        ),
      ],
    ),

    Text(
      '${company.companyContact ?? ''} / ${company.adminContact}',
      style: myNoInfoStyle(
        context,
      ).copyWith(color: cs.onSurface, fontWeight: FontWeight.w500),
    ),

    // Cell 4 — date created
    Text(
      DateFormat('EEEE, MMMM d, y').format(company.onboardedDate!),
      style: myNoInfoStyle(
        context,
      ).copyWith(color: cs.onSurface, fontWeight: FontWeight.w500),
    ),

    // Cell 5 — date created
    Text(
      company.companyIndustry ?? '-',
      style: myNoInfoStyle(
        context,
      ).copyWith(color: cs.onSurface, fontWeight: FontWeight.w500),
    ),
    // Cell 6 — Status
    buildStatusChip(context, company.status),

    // Cell 7 - Options
    GestureDetector(onTap: onTap, child: const Icon(UniconsLine.ellipsis_v)),
  ];
}

Widget buildStatusChip(BuildContext context, CompanyStatus status) {
  final cs = Theme.of(context).colorScheme;

  final (Color bg, Color text, String label) = switch (status) {
    CompanyStatus.active => (
      Colors.greenAccent,
      cs.onPrimaryContainer,
      'Active',
    ),
    CompanyStatus.inactive => (
      Colors.redAccent,
      cs.onErrorContainer,
      'Inactive',
    ),
    CompanyStatus.pending => (
      cs.tertiaryContainer,
      cs.onTertiaryContainer,
      'Pending',
    ),
    CompanyStatus.suspended => (
      cs.surfaceContainerHighest,
      cs.onSurfaceVariant,
      'Suspended',
    ),
  };
  return Card(
    elevation: 0,
    color: bg.withAlpha(50),
    surfaceTintColor: bg.withAlpha(15),
    child: Padding(
      padding: const EdgeInsets.all(5.0),
      child: Center(
        child: Text(
          '● $label',
          style: myMainTextStyle(
            context,
          ).copyWith(color: bg, fontSize: 10, fontWeight: FontWeight.w600),
        ),
      ),
    ),
  );
}
