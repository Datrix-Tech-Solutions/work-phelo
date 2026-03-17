import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/App_Theme/colors.dart';
import 'package:hr_phelo/components/app_theme/app_images.dart';
import 'package:hr_phelo/components/app_widgets/cards/display_card.dart';
import 'package:hr_phelo/components/app_widgets/cards/title_card.dart';
import 'package:hr_phelo/components/form_components/my_buttons.dart';
import 'package:hr_phelo/pages/dashboard/module_options.dart';
import 'package:unicons/unicons.dart';

import '../login_page/login_functions/user_model.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
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
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leadingWidth: 150,
        backgroundColor: ColorScheme.of(context).surface,
        leading: appLogo,
        title: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            MyTextButton(txtBtnText: 'Portal', txtBtnOnPressed: () {}),
            MyTextButton(txtBtnText: 'Reports', txtBtnOnPressed: () {}),
            MyTextButton(txtBtnText: 'Integrations', txtBtnOnPressed: () {}),
            MyTextButton(txtBtnText: 'Supports', txtBtnOnPressed: () {}),
          ],
        ),
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

          IconButton(
            onPressed: () {},
            icon: Icon(UniconsLine.apps, color: myMainColor),
          ),
          IconButton(
            onPressed: () {
              Navigator.pushNamedAndRemoveUntil(
                context,
                '/login',
                (route) => false,
              );
            },
            icon: Icon(UniconsLine.user_circle, color: myMainColor),
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
            child: Padding(
              padding: const EdgeInsets.only(left: 8, right: 8),
              child: DisplayCard(child: ModuleOptions()),
            ),
          ),
        ],
      ),
    );
  }
}
