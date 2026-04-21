import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_components/theme/app_padding.dart';
import 'package:work_phelo/work_phelo_components/widgets/misc/confirmation_pop_up.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';
import '../../../work_phelo_components/theme/app.colors.dart';
import '../../../work_phelo_components/theme/app_text_theme.dart';
import '../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';

class ModuleConfigCard extends ConsumerStatefulWidget {
  final CompanyModel company;
  final VoidCallback? onSave;
  final ValueChanged<String> onOpenModule;

  const ModuleConfigCard({
    super.key,
    this.onSave,
    required this.company,
    required this.onOpenModule,
  });

  @override
  ConsumerState<ModuleConfigCard> createState() => _ModuleConfigCardState();
}

class _ModuleConfigCardState extends ConsumerState<ModuleConfigCard> {
  ///TODO: Remove Dev Bypass and test
  static const bool kDevBypassModules = true;
  late final List<ModuleConfig> _modules;

  @override
  void initState() {
    super.initState();
    _modules = [
      ModuleConfig(
        key: 'hr',
        name: 'Human Resource',
        description: 'Manage employees, payroll, and attendance',
        icon: UniconsLine.users_alt,

        ///TODO: Remove Dev Bypass and test
        isEnabled:
            kDevBypassModules || widget.company.enabledModules.contains('hr'),
        // isEnabled: widget.company.enabledModules.contains('hr'),
      ),
      ModuleConfig(
        key: 'accounting',
        name: 'Accounting',
        description: 'Invoices, expenses, reports & tax',
        icon: UniconsLine.money_bill,
        isEnabled: widget.company.enabledModules.contains('accounting'),
      ),
      ModuleConfig(
        key: 'marketing',
        name: 'Marketing',
        description: 'Campaigns, leads, and customer engagement',
        icon: UniconsLine.chart_bar,
        isEnabled: widget.company.enabledModules.contains('marketing'),
      ),
      ModuleConfig(
        key: 'operations',
        name: 'Operations',
        description: 'Inventory, suppliers & logistics',
        icon: UniconsLine.question_circle,
        isEnabled: widget.company.enabledModules.contains('operations'),
      ),
    ];
  }

  void _save() {
    final enabled = _modules
        .where((m) => m.isEnabled)
        .map((m) => m.key)
        .toList();

    ref
        .read(companyProvider.notifier)
        .updateEnabledModules(widget.company.tenantSlug, enabled);

    confirmationPopup(
      context,
      'Configuration Saved',
      'Module configuration updated successfully',
      () => Navigator.pop(context),
      'Close',
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = ColorScheme.of(context);

    return DisplayCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Module Configuration',
            style: myMainTextStyle(context).copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 17,
              color: cs.onSurface,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Enable or disable modules for this company',
            style: myNoInfoStyle(context).copyWith(color: cs.onSurfaceVariant),
          ),
          Padding(padding: space),

          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.only(right: 15),
              itemCount: _modules.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: myPadding,
                  child: _buildModuleTile(context, _modules[index]),
                );
              },
            ),
          ),

          const SizedBox(height: 20),

          Align(
            alignment: Alignment.centerRight,
            child: MyOutlinedMenuButton(
              btnText: 'Save Configuration',
              btnIcon: UniconsLine.save,
              btnAccent: myMainColor,
              isHovered: true,
              onPressed: _save,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleTile(BuildContext context, ModuleConfig module) {
    final cs = ColorScheme.of(context);

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: BorderRadius.circular(16),
        ),
        child: InkWell(
          onTap: () => widget.onOpenModule(module.key),
          child: Row(
            children: [
              // Icon
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: myMainColor.withAlpha(12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(module.icon, color: myMainColor, size: 28),
              ),
              const SizedBox(width: 8),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      module.name,
                      style: myMainTextStyle(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700, fontSize: 16.5),
                    ),
                    Text(
                      module.description,
                      style: myNoInfoStyle(
                        context,
                      ).copyWith(color: cs.onSurfaceVariant, height: 1.4),
                    ),
                  ],
                ),
              ),

              AbsorbPointer(
                absorbing: false,

                child: InkWell(
                  onTap: () =>
                      setState(() => module.isEnabled = !module.isEnabled),
                  child: Switch(
                    value: module.isEnabled,
                    activeThumbColor: myMainColor,
                    onChanged: (val) => setState(() => module.isEnabled = val),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
