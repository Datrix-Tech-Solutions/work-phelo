import 'package:flutter/material.dart';
import '../../../../../work_phelo_components/widgets/custom_cards/display_card.dart';
import '../../../../../work_phelo_components/widgets/custom_cards/title_card.dart';
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
