import 'package:flutter/material.dart';

import '../../../../../components/app_widgets/cards/display_card.dart';
import '../../../../../components/app_widgets/cards/title_card.dart';
import 'off_boarding_widgets/off_boarding_form.dart';

class OffboardingLayout extends StatelessWidget {
  const OffboardingLayout({super.key});

  @override
  Widget build(BuildContext context) {
    return DisplayCard(
      child: Column(
        children: [
          WelcomeCardAlt(
            title: 'Employee Offboarding',
            details: 'Manage Employee exits',
          ),

          Flexible(child: OffBoardingForm()),
        ],
      ),
    );
  }
}
