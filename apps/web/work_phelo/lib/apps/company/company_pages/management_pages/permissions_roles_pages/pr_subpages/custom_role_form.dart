import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../../../../../../Functions/company_functions/permissions/app_module.dart';
import '../../../../../../Functions/company_functions/permissions/roles_state.dart';
import '../../../../../../components/app_theme/misc.dart';
import '../../../../../../components/app_theme/text_styles.dart';
import '../../../../../../components/app_widgets/cards/display_card.dart';
import '../../../../../../components/form_components/my_buttons.dart';
import '../../../../../../components/form_components/text_fields.dart';

class CustomRoleForm extends ConsumerStatefulWidget {
  final AppUser currentUser;
  final VoidCallback onSaved;

  const CustomRoleForm({super.key, required this.onSaved,required this.currentUser});

  @override
  ConsumerState<CustomRoleForm> createState() => CustomRoleFormState();
}

class CustomRoleFormState extends ConsumerState<CustomRoleForm> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final Set<AppModule> _selectedModules = {};

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _save() {
    if (_nameController.text.trim().isEmpty) return;
    final role = AppRole(
      id: 'custom_${DateTime.now().millisecondsSinceEpoch}',
      name: _nameController.text.trim(),
      description: _descController.text.trim().isEmpty
          ? 'Custom role'
          : _descController.text.trim(),
      modules: _selectedModules,
      color: Theme.of(context).colorScheme.primary,
      tenantSlug: widget.currentUser.tenantSlug,
    );
    ref.read(rolesProvider.notifier).addRole(role);
    widget.onSaved();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    const double csize = 0.35;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        ListTile(
          title: Text('New custom role', style: myLargeTextStyle(context)),
          subtitle: Text(
            'Define a name, description and module access',
            style: myMainTextStyle(
              context,
            ).copyWith(color: cs.onSurfaceVariant),
          ),
        ),

        MyCustomTextField(
          label: 'Role name',
          placeholder: 'e.g. Finance Auditor',
          controller: _nameController,
          validator: (v) => v?.trim().isEmpty ?? true ? 'Required' : null,
        ),
        MyCustomTextField(
          label: 'Description',
          placeholder: 'What does this role have access to?',
          controller: _descController,
        ),
        //
        //
        //
        Expanded(
          child: DisplayCard(
            child: ListView.separated(
              itemCount: AppModule.values.length,
              separatorBuilder: (_, _) => myDivider(context),
              itemBuilder: (context, index) {
                final module = AppModule.values[index];
                final isOn = _selectedModules.contains(module);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          module.label,
                          style: myMainTextStyle(
                            context,
                          ).copyWith(fontWeight: FontWeight.w500),
                        ),
                      ),
                      Switch(
                        value: isOn,
                        onChanged: (_) => setState(
                          () => isOn
                              ? _selectedModules.remove(module)
                              : _selectedModules.add(module),
                        ),
                        activeThumbColor: cs.primary,
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        SizedBox(
          width: MediaQuery.sizeOf(context).width * csize,
          child: MyButton(btnText: 'Add role', btnOnPressed: _save),
        ),
      ],
    );
  }
}
