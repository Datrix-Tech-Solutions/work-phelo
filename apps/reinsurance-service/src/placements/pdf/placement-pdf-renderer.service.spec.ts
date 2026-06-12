import {
  PlacementDocumentStatus,
  PlacementDocumentType,
} from '../../../prisma/generated/client';
import { PlacementDocumentTemplateRegistry } from './placement-document-template.registry';
import { PlacementPdfRendererService } from './placement-pdf-renderer.service';

const pdfMock = jest.fn();
const setContentMock = jest.fn();
const newPageMock = jest.fn();
const closeMock = jest.fn();
const launchMock = jest.fn();

jest.mock('playwright-core', () => ({
  chromium: {
    launch: (...args: unknown[]): unknown => {
      const result: unknown = launchMock(...args);
      return result;
    },
  },
}));

describe('PlacementPdfRendererService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pdfMock.mockResolvedValue(Buffer.from('%PDF mocked'));
    setContentMock.mockResolvedValue(undefined);
    newPageMock.mockResolvedValue({
      setContent: setContentMock,
      pdf: pdfMock,
    });
    closeMock.mockResolvedValue(undefined);
    launchMock.mockResolvedValue({
      newPage: newPageMock,
      close: closeMock,
    });
    delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  });

  it('renders registry HTML through Playwright Chromium', async () => {
    const renderer = new PlacementPdfRendererService(
      new PlacementDocumentTemplateRegistry(),
    );

    const pdf = await renderer.render({
      documentNumber: 'DOC-CS-001',
      title: 'Closing Slip CLO-001',
      type: PlacementDocumentType.CLOSING_SLIP,
      status: PlacementDocumentStatus.GENERATED,
      generatedAt: '2026-06-12T00:00:00.000Z',
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    });

    expect(pdf.toString()).toBe('%PDF mocked');
    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }),
    );
    expect(setContentMock).toHaveBeenCalledWith(
      expect.stringContaining('DOC-CS-001'),
      { waitUntil: 'networkidle' },
    );
    expect(pdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        printBackground: true,
      }),
    );
    expect(closeMock).toHaveBeenCalled();
  });

  it('uses configured system Chromium path when provided', async () => {
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = '/usr/bin/chromium';
    const renderer = new PlacementPdfRendererService(
      new PlacementDocumentTemplateRegistry(),
    );

    await renderer.render({
      documentNumber: 'DOC-CS-001',
      title: 'Closing Slip CLO-001',
      type: PlacementDocumentType.CLOSING_SLIP,
      status: PlacementDocumentStatus.GENERATED,
      generatedAt: null,
      renderPayload: {
        documentType: PlacementDocumentType.CLOSING_SLIP,
        closing: { closingNumber: 'CLO-001' },
      },
    });

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: '/usr/bin/chromium',
      }),
    );
  });
});
