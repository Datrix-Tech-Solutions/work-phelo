export declare const ERP_MODULES: {
  readonly HR_CORE: 'hr_core';
  readonly LEAVE: 'leave';
  readonly PAYROLL: 'payroll';
  readonly CLOCKING: 'clocking';
  readonly SCHEDULING: 'scheduling';
  readonly APPRAISAL: 'appraisal';
  readonly PROJECTS: 'projects';
  readonly ASSETS: 'assets';
  readonly MARKETING: 'marketing';
  readonly ACCOUNTING: 'accounting';
};
export type ErpModule = (typeof ERP_MODULES)[keyof typeof ERP_MODULES];
//# sourceMappingURL=modules.config.d.ts.map
