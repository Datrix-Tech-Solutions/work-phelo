import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';

import '../Components/app_theme/text_styles.dart';
import '../Functions/Super_Admin_Functions/company_state.dart';
import '../Functions/company_functions/permissions/company_roles.dart';
import '../components/app_theme/app_images.dart';
import '../components/form_components/my_buttons.dart';

class GetStartedPage extends ConsumerWidget {
  final AppUser currentUser;

  const GetStartedPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Welcome to'),
                appLogo,
                Text(
                  currentUser.companyName,
                  style: myLargeTextStyle(context),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'Your workspace is ready. Let\'s get everything set up.',
                  style: myMainTextStyle(
                    context,
                  ).copyWith(color: ColorScheme.of(context).onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),
                MyButton(
                  btnText: 'Get started',
                  btnOnPressed: () {
                    // Activate the company
                    ref
                        .read(companyProvider.notifier)
                        .setActive(currentUser.tenantSlug);
                        seedRoles(ref, currentUser.tenantSlug);

                    // Navigate to the management page
                    Navigator.pushNamedAndRemoveUntil(
                      context,
                      '/dashboard',
                      (route) => false,
                      arguments: {'user': currentUser, 'initialIndex': 2},
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
