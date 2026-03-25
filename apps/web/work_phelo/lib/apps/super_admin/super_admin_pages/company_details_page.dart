import 'package:flutter/material.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';
import 'package:work_phelo/functions/super_admin_functions/company_model.dart';

import '../../../components/app_theme/padding.dart';
import '../../../components/app_theme/text_styles.dart';
import '../../../components/app_widgets/cards/company_details_card.dart';
import '../../../components/app_widgets/cards/display_card.dart';
import '../../../components/app_widgets/cards/title_card.dart';
import '../../../components/app_widgets/lists/app_lists.dart';
import 'module_config_card.dart';

class CompanyDetailPage extends StatelessWidget {
  final CompanyModel company;
  final AppUser currentUser;
  final VoidCallback onBack;

  const CompanyDetailPage({
    super.key,
    required this.company,
    required this.currentUser,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Breadcrumb
        Padding(
          padding: formPadding,
          child: InkWell(
            hoverColor: Colors.transparent,
            splashColor: Colors.transparent,
            highlightColor: Colors.transparent,
            onTap: onBack,
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: 'Dashboard > ', style: myNoInfoStyle(context)),
                  TextSpan(
                    text: company.companyName,
                    style: myNoInfoStyle(context).copyWith(color: cs.onSurface),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Top bar — status + actions
        CompanyCard(company: company, onDelete: () {}, onToggleStatus: () {}),

        // Middle row — detail card + placeholder
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: CompanyDetailCard(company: company)),
              Expanded(child: ModuleConfigCard(company: company)),
            ],
          ),
        ),

        // Bottom row — placeholder
        Expanded(
          child: DisplayCard(
            child: AppListWidget(
              headerTitle: 'Resent Activities',
              itemCount: 0,
              itemBuilder: (context, index) {
                return Card(child: ListTile());
              },
            ),
          ),
        ),
      ],
    );
  }
}
