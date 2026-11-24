import {
  registeredModuleFor,
  registrationFor,
  SOURCE_REGISTRY,
} from './source-registry';

describe('source registry', () => {
  it('serves the generic source-transaction routes for marketing, operations and projects, not payroll', () => {
    expect(registrationFor('MARKETING')?.serviceName).toBe('marketing-service');
    expect(registrationFor('PROJECTS')?.serviceName).toBe('hr-service');
    expect(registrationFor('HR')).toBeUndefined();
  });

  it('describes project billing as its own source, told about its invoices in hr-service', () => {
    expect(registrationFor('PROJECTS')).toMatchObject({
      sourceName: 'Project Billing',
      moduleConfigKey: 'hr',
      callback: {
        baseUrlEnv: 'HR_SERVICE_URL',
        path: '/internal/accounting-events',
      },
    });
    // Receivable by default: an invoice or a direct receipt.
    expect(registrationFor('PROJECTS')?.direction).toBeUndefined();
  });

  it('still describes payroll: its source, its caller and where it is told about settlements', () => {
    expect(registeredModuleFor('HR')).toMatchObject({
      sourceName: 'Payroll',
      serviceName: 'hr-service',
      moduleConfigKey: 'hr',
      callback: {
        baseUrlEnv: 'HR_SERVICE_URL',
        path: '/internal/payroll-settlement',
      },
    });
    expect(SOURCE_REGISTRY.HR?.raisesTransactions).toBe(false);
  });

  it('knows nothing about modules that are not registered', () => {
    expect(registeredModuleFor('RECRUITMENT')).toBeUndefined();
    expect(registrationFor('NOPE')).toBeUndefined();
  });
});
