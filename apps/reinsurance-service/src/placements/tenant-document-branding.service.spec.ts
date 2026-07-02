import { RequestUser } from '@work-phelo/types';
import { TenantDocumentBrandingService } from './tenant-document-branding.service';

describe('TenantDocumentBrandingService', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'irisk',
    tenantName: 'iRisk Reinsurance Brokers',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  };
  const originalFetch = global.fetch;
  const originalAuthUrl = process.env.AUTH_SERVICE_INTERNAL_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_SERVICE_INTERNAL_URL;
    } else {
      process.env.AUTH_SERVICE_INTERNAL_URL = originalAuthUrl;
    }
  });

  it('embeds canonical tenant logo bytes in the immutable branding snapshot', async () => {
    process.env.AUTH_SERVICE_INTERNAL_URL = 'http://localhost:5001';
    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tenantName: 'iRisk Reinsurance Brokers',
            logoDisplayUrl: 'https://app.workphelo.com/iriskre.png',
            primaryColor: '#112233',
            secondaryColor: '#445566',
            accentColor: '#778899',
            documentHeaderColor: '#112233',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('tenant-logo'), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      );
    global.fetch = fetchMock;

    const result = await new TenantDocumentBrandingService().resolve(user);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      productName: 'iRisk Reinsurance Brokers',
      logoDataUrl: `data:image/png;base64,${Buffer.from('tenant-logo').toString('base64')}`,
      watermarkDataUrl: `data:image/png;base64,${Buffer.from('tenant-logo').toString('base64')}`,
      documentHeaderColor: '#112233',
    });
  });

  it('falls back to tenant identity when branding cannot be resolved', async () => {
    global.fetch = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValue(new Error('offline'));

    const result = await new TenantDocumentBrandingService().resolve(user);

    expect(result).toMatchObject({
      productName: 'iRisk Reinsurance Brokers',
      logoDataUrl: null,
      watermarkDataUrl: null,
    });
  });
});
