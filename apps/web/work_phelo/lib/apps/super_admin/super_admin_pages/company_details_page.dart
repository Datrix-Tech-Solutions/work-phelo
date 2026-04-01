import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/custom_cards/company_card.dart';
import '../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import '../../../work_phelo_components/widgets/custom_cards/title_card.dart';
import '../../../work_phelo_components/widgets/custom_lists/app_list.dart';
import '../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import '../../../work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import '../../../work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';
import '../super_admin_widgets/admin_update_form.dart';
import '../super_admin_widgets/company_editing_form.dart';
import '../super_admin_widgets/module_features.dart';
import 'module_config_card.dart';

class CompanyDetailPage extends ConsumerStatefulWidget {
  final CompanyModel company;
  final VoidCallback onBack;

  const CompanyDetailPage({
    super.key,
    required this.company,
    required this.onBack,
  });

  @override
  ConsumerState<CompanyDetailPage> createState() => _CompanyDetailPageState();
}

class _CompanyDetailPageState extends ConsumerState<CompanyDetailPage> {
  late final _panel = SidePanelController();
  final _editingFormKey = GlobalKey<CompanyEditingFormState>();
  final _adminEditingFormKey = GlobalKey<AdminUpdateFormState>();

  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);
    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: formPadding,
          child: InkWell(
            hoverColor: Colors.transparent,
            splashColor: Colors.transparent,
            highlightColor: Colors.transparent,
            onTap: widget.onBack,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: 'Dashboard',
                        style: myNoInfoStyle(context),
                      ),
                      TextSpan(text: ' > ', style: myNoInfoStyle(context)),
                      TextSpan(
                        text: widget.company.companyName,
                        style: myNoInfoStyle(context).copyWith(
                          color: cs.onSurface,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Top bar — status + actions
        CompanyCard(
          company: widget.company,
          onDelete: () {},
          onToggleStatus: () async {
    try {
      await ref
          .read(companyProvider.notifier)
          .toggleCompanyStatus(widget.company);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  },
        ),

        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: CompanyDetailCard(
                  company: widget.company,
                  onEdit: () => _panel.show(
                    context: context,
                    formTitle: 'Company Editing Form',
                    onPressed: () async {},
                    secOnPressed: () {},
                    child: CompanyEditingForm(key: _editingFormKey),
                  ),
                  onAdminEdit: () => _panel.show(
                    context: context,
                    formTitle: 'Assign Company Administrator',
                    onPressed: () async {},
                    secOnPressed: () {},
                    child: AdminUpdateForm(key: _adminEditingFormKey),
                  ),
                ),
              ),
              Expanded(
                child: ModuleConfigCard(
                  company: widget.company,
                  onOpenModule: (String moduleKey) {
                    _panel.show(
                      context: context,
                      formTitle: _getModuleTitle(moduleKey),
                      onPressed: () async {},
                      secOnPressed: () {},
                      child: ModuleFeatures(moduleKey: moduleKey),
                    );
                  },
                ),
              ),
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

String _getModuleTitle(String key) {
  switch (key) {
    case 'hr':
      return 'Human Resource Features';
    case 'accounting':
      return 'Accounting Features';
    case 'marketing':
      return 'Marketing Features';
    case 'operations':
      return 'Operations Features';
    default:
      return 'Module Features';
  }
}
