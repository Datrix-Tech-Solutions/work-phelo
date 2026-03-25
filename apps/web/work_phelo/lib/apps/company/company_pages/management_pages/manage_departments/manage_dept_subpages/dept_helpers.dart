import 'package:flutter/material.dart';

import '../../../../../../Components/App_Theme/text_styles.dart';
import '../../../../../../Functions/company_functions/onboarding_function/onboarding_model.dart';
import '../../../../../../components/app_theme/misc.dart';

class SectionLabel extends StatelessWidget {
  final String label;
  const SectionLabel({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: myMainTextStyle(context).copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }
}

class MemberTile extends StatelessWidget {
  final UserModel user;
  final Widget? trailing;

  const MemberTile({super.key, required this.user, this.trailing});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: cs.primaryContainer,
        child: Text(
          '${user.firstName[0]}${user.lastName[0]}',
          style: TextStyle(fontSize: 12, color: cs.onPrimaryContainer),
        ),
      ),
      title: Text(user.fullName, style: myMainTextStyle(context)),
      subtitle: Text(
        user.jobTitle,
        style: myMainTextStyle(
          context,
        ).copyWith(fontSize: 11, color: cs.onSurfaceVariant),
      ),
      trailing: trailing,
    );
  }
}

class SetHeadTile extends StatelessWidget {
  final List<UserModel> members;
  final void Function(String email) onSet;

  const SetHeadTile({super.key, required this.members, required this.onSet});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (members.isEmpty) {
      return Text(
        'Add members first before setting a head',
        style: myMainTextStyle(context).copyWith(color: cs.onSurfaceVariant),
      );
    }
    return DropdownButtonFormField<String>(
      decoration: const InputDecoration(
        labelText: 'Set department head',
        border: OutlineInputBorder(),
      ),
      items: members
          .map((u) => DropdownMenuItem(value: u.email, child: Text(u.fullName)))
          .toList(),
      onChanged: (email) {
        if (email != null) onSet(email);
      },
    );
  }
}



class EmptyDetail extends StatelessWidget {
  const EmptyDetail({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(appRadius),
      ),
      child: Center(
        child: Text(
          'Select a department to view details',
          style: myMainTextStyle(context).copyWith(color: cs.onSurfaceVariant),
        ),
      ),
    );
  }
}