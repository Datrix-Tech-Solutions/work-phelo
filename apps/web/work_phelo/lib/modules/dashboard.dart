import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';
import 'package:work_phelo/functions/app_users/login_functions/auth_state.dart';

import '../components/app_theme/app_images.dart';
import '../components/app_theme/colors.dart';
import '../components/app_theme/misc.dart';
import '../components/app_widgets/cards/display_card.dart';
import '../components/app_widgets/cards/title_card.dart';
import '../components/app_widgets/user_avators.dart';
import '../pages/log_out/user_details_popup.dart';
import 'module_options.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  late AppUser user;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is AppUser) {
      user = args;
    } else {
      user = AppUser(
        uid: '',
        email: 'unknown',
        fullName: 'Guest',
        role: 'guest',
        companyName: 'company_name',
        lastLogin: DateTime.now(),
        tenantSlug: '',
        companyStatus: '',
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          Navigator.pushNamedAndRemoveUntil(
            context,
            '/login',
            (route) => false,
          );
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authNotifierProvider, (previous, next) {
      if (previous?.isAuthenticated == true && !next.isAuthenticated) {
        Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
      }
    });
    return Scaffold(
      appBar: AppBar(
        leadingWidth: 150,
        backgroundColor: ColorScheme.of(context).surface,
        leading: appLogo,

        actions: [
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.notifications_none, color: myMainColor),
          ),
          IconButton(
            onPressed: () {},
            icon: Icon(UniconsLine.question_circle, color: myMainColor),
          ),
          IconButton(
            onPressed: () {},
            icon: Icon(UniconsLine.setting, color: myMainColor),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: InkWell(
              onTap: () => Navigator.pushNamedAndRemoveUntil(
                context,
                '/login',
                (route) => false,
              ),
              borderRadius: BorderRadius.circular(appRadius),
              child: UserDashIcon(
                onIconPressed: (details) {
                  UserDetailsPopup.show(
                    context,
                    details.globalPosition,
                    user,
                    ref,
                  );
                },
                initials: user.fullName.isNotEmpty
                    ? user.fullName
                          .trim()
                          .split(' ')
                          .map((e) => e[0])
                          .take(2)
                          .join()
                    : 'G',
              ),
            ),
          ),
          Padding(padding: EdgeInsets.all(10)),
        ],
      ),
      body: Column(
        children: [
          TitleCard(
            introText: 'Good morning, ${user.fullName}',
            companyName: user.companyName,
          ),
          Expanded(
            child: DisplayCard(child: ModuleOptions(currentUser: user)),
          ),
        ],
      ),
    );
  }
}
