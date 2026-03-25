import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/functions/app_users/app_user_model.dart';
import 'package:work_phelo/functions/app_users/login_functions/auth_state.dart';
import 'package:work_phelo/functions/super_admin_functions/company_model.dart';

import '../../../Components/app_theme/colors.dart';
import '../../../Functions/super_admin_functions/company_state.dart';
import '../../../components/app_theme/padding.dart';
import '../../../components/app_widgets/cards/title_card.dart';
import '../../../components/app_widgets/lists/app_lists.dart';
import '../../../components/form_components/my_buttons.dart';
import '../../../components/form_components/my_side_panel.dart';
import '../super_admin_widgets/company_onboarded_list.dart';
import 'company_onboarding_form.dart';

class SuperAdminPortal extends ConsumerStatefulWidget {
  final AppUser currentUser;
  final ValueChanged<CompanyModel> onCompanySelected;
  const SuperAdminPortal({
    super.key,
    required this.currentUser,
    required this.onCompanySelected,
  });

  @override
  ConsumerState<SuperAdminPortal> createState() => _SuperAdminPortalState();
}

class _SuperAdminPortalState extends ConsumerState<SuperAdminPortal> {
  late final _panel = SidePanelController();
  final _formKey = GlobalKey<CompanyOnboardingFormState>();
  String statDisplay(String value) => value == '0' ? '-' : value;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(companyProvider);
    final companies = state.companies;
    ref.listen<AuthState>(authNotifierProvider, (previous, next) {
      if (previous?.isAuthenticated == true && !next.isAuthenticated) {
        Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
      }
    });

    // Move these above the stats list
    final totalCompanies = companies.length;
    final activeCompanies = companies
        .where((c) => c.status == CompanyStatus.active)
        .length;
    final inactiveCompanies = companies
        .where((c) => c.status == CompanyStatus.inactive)
        .length;
    final currentMonth = DateTime.now().month;
    final currentYear = DateTime.now().year;
    final newThisMonth = companies.where((c) {
      final d = c.onboardedDate;
      return d != null && d.month == currentMonth && d.year == currentYear;
    }).length;

    return Column(
      children: [
        TitleCard(
          companyName: widget.currentUser.companyName,
          introText: 'Good morning, ${widget.currentUser.fullName}',
          stats: [
            TitleCardStat(
              title: 'Total Companies',
              value: statDisplay('$totalCompanies'),
            ),
            TitleCardStat(
              title: 'Active Companies',
              value: statDisplay('$activeCompanies'),
            ),
            TitleCardStat(
              title: 'Inactive Companies',
              value: statDisplay('$inactiveCompanies'),
            ),
            TitleCardStat(
              title: 'New this ${DateFormat('MMMM').format(DateTime.now())}',
              value: statDisplay('$newThisMonth'),
            ),
          ],
        ),

        Expanded(
          child: Padding(
            padding: menuCardpadding,
            child: AppTableWidget(
              headerTitle: 'Companies',
              headerTrailing: MyOutlinedMenuButton(
                btnText: 'Onboard Company',
                btnIcon: UniconsLine.user_plus,
                btnAccent: myMainColor,
                isHovered: false,
                onPressed: () => _panel.show(
                  context: context,
                  formTitle: 'COMPANY ONBOARDING FORM',
                  onPressed: () {
                    final company = _formKey.currentState?.submit();
                    if (company == null) return;
                    ref.read(companyProvider.notifier).addCompany(company);
                    _panel.close();
                  },
                  secOnPressed: () => _formKey.currentState?.reset(),
                  child: CompanyOnboardingForm(
                    key: _formKey,
                    currentUser: widget.currentUser,
                  ),
                ),
              ),
              columns: const [
                TableColumn(
                  header: 'Company Details',
                  width: FlexColumnWidth(2),
                ),
                TableColumn(header: 'Administrator', width: FlexColumnWidth(2)),
                TableColumn(header: 'Contact', width: FlexColumnWidth(1)),
                TableColumn(header: 'Date Created', width: FlexColumnWidth(1)),
                TableColumn(header: 'Industry', width: FlexColumnWidth(1)),
                TableColumn(header: 'Status', width: FixedColumnWidth(150)),
                TableColumn(header: '', width: FixedColumnWidth(50)),
              ],
              itemCount: companies.length,
              rowBuilder: (context, index) => buildCompanyOnboardedRowCells(
                context,
                companies[index],
                ref,
                onTap: () => widget.onCompanySelected(companies[index]),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
