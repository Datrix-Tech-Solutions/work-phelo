import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { TenantDocumentProfileService } from './tenant-document-profile.service';
import { TenantDocumentRenderController } from './tenant-document-render.controller';
import { TenantDocumentTemplateService } from './tenant-document-template.service';
import { DEFAULT_DOCUMENT_TEMPLATE_CONFIG } from './tenant-document-template.service';

function requestFor(overrides: Partial<RequestUser> = {}) {
  return {
    user: {
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'EMPLOYEE',
      permissions: ['accounting.receivables:VIEW'],
      ...overrides,
    },
  } as never;
}

function makeController(
  config: Partial<typeof DEFAULT_DOCUMENT_TEMPLATE_CONFIG> = {},
) {
  const templates = {
    get: jest.fn().mockResolvedValue({
      config: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG, ...config },
      version: 2,
      defaultsApplied: false,
      watermarkUrl: null,
    }),
  };
  const profiles = {
    get: jest.fn().mockResolvedValue({
      displayName: 'Acme',
      legalName: 'Acme Ltd',
      taxNumber: 'TIN-1',
      bankAccounts: [{ accountNumber: '123' }],
      logoUrl: 'https://logo',
      signatureUrl: 'https://signature',
      authorizedSignatoryName: 'Ama',
      authorizedSignatoryTitle: 'Director',
    }),
  };
  return new TenantDocumentRenderController(
    templates as unknown as TenantDocumentTemplateService,
    profiles as unknown as TenantDocumentProfileService,
  );
}

describe('TenantDocumentRenderController', () => {
  it('lets an accounting viewer read their own company, without private details', async () => {
    const result = await makeController().get('tenant-1', requestFor());

    expect(result.profile.logoUrl).toBe('https://logo');
    expect(result.profile).not.toHaveProperty('bankAccounts');
    expect(result.profile).not.toHaveProperty('taxNumber');
  });

  it('rejects another company and users without accounting access', async () => {
    const controller = makeController();

    await expect(controller.get('tenant-2', requestFor())).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      controller.get('tenant-1', requestFor({ permissions: [] })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('gives report viewers the letterhead without the signature', async () => {
    const result = await makeController({
      signatureEnabled: true,
      signatureRules: {
        ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.signatureRules,
        invoice: true,
      },
    }).get('tenant-1', requestFor({ permissions: ['accounting.ledger:VIEW'] }));

    expect(result.profile.logoUrl).toBe('https://logo');
    expect(result.profile.signatureUrl).toBeNull();
  });

  it('returns the signature only when an accounting document is signed', async () => {
    const rules = DEFAULT_DOCUMENT_TEMPLATE_CONFIG.signatureRules;
    const unsigned = await makeController({
      signatureEnabled: true,
      signatureRules: { ...rules, payslip: true },
    }).get('tenant-1', requestFor());
    const signed = await makeController({
      signatureEnabled: true,
      signatureRules: { ...rules, invoice: true },
    }).get('tenant-1', requestFor());

    expect(unsigned.profile.signatureUrl).toBeNull();
    expect(signed.profile.signatureUrl).toBe('https://signature');
  });
});
