import 'package:flutter/material.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/custom_cards/company_card.dart';
import '../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import '../../../work_phelo_components/widgets/custom_cards/title_card.dart';
import '../../../work_phelo_components/widgets/custom_lists/app_list.dart';
import 'module_config_card.dart';

class CompanyDetailPage extends StatelessWidget {
  final CompanyModel company;
  final AppUserModel currentUser;
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
