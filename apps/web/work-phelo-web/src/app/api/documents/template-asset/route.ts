import { NextRequest } from 'next/server';
import type { TenantDocumentRender } from '@/types/tenant-document-template';

export const runtime = 'nodejs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://dev-api.workphelo.com/api/v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ASSETS = {
  logo: (data: TenantDocumentRender) => data.profile.logoUrl,
  signature: (data: TenantDocumentRender) => data.profile.signatureUrl,
  watermark: (data: TenantDocumentRender) => data.template.watermarkUrl,
};

/**
 * Same-origin proxy for the images on a company document. The API hands back
 * short-lived, cross-origin signed URLs, which an `<img>` html2canvas has to
 * rasterise can't use. A fresh URL is resolved with the caller's own session, so
 * the API's access rules apply here too.
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? '';
  const asset = req.nextUrl.searchParams.get('asset') ?? '';
  if (!UUID.test(tenantId) || !Object.hasOwn(ASSETS, asset)) {
    return new Response('Invalid request', { status: 400 });
  }

  const cookie = req.headers.get('cookie') ?? '';
  const authorization = req.headers.get('authorization') ?? '';

  try {
    const renderRes = await fetch(`${API_BASE}/auth/tenants/${tenantId}/document-render`, {
      headers: {
        accept: 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
      cache: 'no-store',
    });
    if (!renderRes.ok) return new Response('Template unavailable', { status: 404 });

    const data = (await renderRes.json()) as TenantDocumentRender;
    const url = ASSETS[asset as keyof typeof ASSETS](data);
    if (!url) return new Response('No image on file', { status: 404 });

    const imageRes = await fetch(url, { cache: 'no-store' });
    if (!imageRes.ok || !imageRes.body) {
      return new Response('Image fetch failed', { status: 404 });
    }
    return new Response(imageRes.body, {
      status: 200,
      headers: {
        'Content-Type': imageRes.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response('Image fetch failed', { status: 404 });
  }
}
