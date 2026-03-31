class ModuleFeaturesData {
  static List<FeatureItem> getFeaturesForModule(String moduleKey) {
    switch (moduleKey.toLowerCase()) {
      case 'hr':
        return [
          FeatureItem(name: "Employee Management", isEnabled: false),
          FeatureItem(name: "Leave Management", isEnabled: false),
          FeatureItem(name: "Department Management", isEnabled: false),
          FeatureItem(name: "Appraisal Management", isEnabled: false),
          FeatureItem(name: "Time Tracking", isEnabled: false),
          FeatureItem(name: "Smart Scheduling", isEnabled: false),
          FeatureItem(name: "Project Management", isEnabled: false),
          FeatureItem(name: "Payroll Processing", isEnabled: false),
          FeatureItem(name: "Asset Management", isEnabled: false),
        ];

      case 'accounting':
        return [
          FeatureItem(name: "Invoice Management", isEnabled: false),
          FeatureItem(name: "Expense Tracking", isEnabled: false),
          FeatureItem(name: "Financial Reporting", isEnabled: false),
        ];

      case 'marketing':
        return [FeatureItem(name: "Marketing Management", isEnabled: false)];

      case 'operations':
        return [FeatureItem(name: "Operations", isEnabled: false)];

      default:
        return [];
    }
  }
}

class FeatureItem {
  final String name;
  bool isEnabled;

  FeatureItem({required this.name, required this.isEnabled});
}
