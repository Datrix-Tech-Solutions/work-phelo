import 'package:flutter/material.dart';
import 'package:hr_phelo/Modules/hr_phelo/hr_pages/hr_people_management/onboarding/onboarding_widgets/onboarding_form.dart';
import 'package:hr_phelo/components/app_widgets/cards/display_card.dart';
import 'package:hr_phelo/components/app_widgets/cards/title_card.dart';

class OnboardingLayout extends StatefulWidget {
  const OnboardingLayout({super.key});

  @override
  State<OnboardingLayout> createState() => _OnboardingLayoutState();
}

class _OnboardingLayoutState extends State<OnboardingLayout> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          WelcomeCardAlt(
            title: 'Employee Onboarding',
            details: 'Add new employees to your systme',
          ),

          /// form area
          Flexible(
            child: Center(
              child: SingleChildScrollView(
                child: Card(
                  color: ColorScheme.of(context).surface,
                  elevation: 0,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 40,
                      vertical: 40,
                    ),
                    child: DisplayCard(child: OnboardingForm()),
                  ),
                ),
              ),
            ),
          ),
          // image area
        ],
      ),
    );
  }
}
