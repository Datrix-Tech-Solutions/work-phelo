import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_login_functions/authentication_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_super_admin/company_onboarding_state.dart';
import '../../../work_phelo_components/theme/app.colors.dart';
import '../../../work_phelo_components/theme/app_padding.dart';
import '../../../work_phelo_components/widgets/custom_cards/title_card.dart';
import '../../../work_phelo_components/widgets/custom_lists/app_table_widget.dart';
import '../../../work_phelo_components/widgets/form_components/app_buttons.dart';
import '../../../work_phelo_components/widgets/form_components/side_form_panel.dart';
import '../super_admin_widgets/company_onboarded_list.dart';
import '../super_admin_widgets/company_onboarding_form.dart';

class SuperAdminPortal extends ConsumerStatefulWidget {
  final ValueChanged<CompanyModel> onCompanySelected;
  const SuperAdminPortal({super.key, required this.onCompanySelected});

  @override
  ConsumerState<SuperAdminPortal> createState() => _SuperAdminPortalState();
}

class _SuperAdminPortalState extends ConsumerState<SuperAdminPortal> {
  late final _panel = SidePanelController();
  final _formKey = GlobalKey<CompanyOnboardingFormState>();
  String statDisplay(String value) => value == '0' ? '-' : value;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(companyProvider.notifier).fetchCompanies();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(companyProvider);
    final companies = state.companies;
    ref.listen<AuthenticationState>(authNotifierProvider, (previous, next) {
      if (previous?.user != null && next.user == null && !next.isLoading) {
    context.go('/platform/login');
  }
    });

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

    final authState = ref.watch(authNotifierProvider);
    final currentUser = authState.user;

    if (currentUser == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final isLoading = state.isLoading;

    return Column(
      children: [
        TitleCard(
          companyName: currentUser.companyName,
          introText: 'Good morning, ${currentUser.fullName}',
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
              noDataText: isLoading
                  ? 'Loading companies...'
                  : 'No companies onboarded yet.',
              headerTrailing: MyOutlinedMenuButton(
                btnText: 'Onboard Company',
                btnIcon: UniconsLine.user_plus,

                btnAccent: myMainColor,
                isHovered: false,
                onPressed: () => _panel.show(
                  context: context,
                  formTitle: 'COMPANY ONBOARDING FORM',
                  onPressed: () async {
                    final company = _formKey.currentState?.submit();
                    if (company == null) return;

                    try {
                      final result = await ref
                          .read(companyProvider.notifier)
                          .registerCompany(company);

                      _panel.close();

                      await ref.read(companyProvider.notifier).fetchCompanies();

                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              result['message'] as String? ??
                                  'Company registered. Verification email sent.',
                            ),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    } catch (e) {
                      // Show error without closing panel
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              e.toString().replaceFirst('Exception: ', ''),
                            ),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    }
                  },
                  secOnPressed: () => _formKey.currentState?.reset(),
                  child: CompanyOnboardingForm(key: _formKey),
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
