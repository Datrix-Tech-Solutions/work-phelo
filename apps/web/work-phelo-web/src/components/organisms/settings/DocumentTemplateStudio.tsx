'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { Button } from '@/components/atoms/Button';
import { useToast } from '@/hooks/useToast';
import {
  useTenantDocumentProfile,
  useUpdateTenantDocumentProfile,
  useUploadTenantDocumentAsset,
} from '@/hooks/useTenantDocumentProfile';
import {
  useRemoveTenantDocumentWatermark,
  useSaveTenantDocumentTemplate,
  useTenantDocumentTemplate,
  useUploadTenantDocumentWatermark,
} from '@/hooks/useTenantDocumentTemplate';
import { useAuthStore } from '@/store/auth.store';
import {
  DEFAULT_TEMPLATE,
  type DocumentTemplate,
  type TemplateAssetHandlers,
} from '@/components/molecules/settings/document-template/templateConfig';
import {
  hasSignatoryChanges,
  serverImages,
  toEditorTemplate,
  toTemplateConfig,
} from '@/components/molecules/settings/document-template/templateMapping';
import { LetterheadSection } from '@/components/molecules/settings/document-template/LetterheadSection';
import { WatermarkSection } from '@/components/molecules/settings/document-template/WatermarkSection';
import { SignatureSection } from '@/components/molecules/settings/document-template/SignatureSection';
import { FooterSection } from '@/components/molecules/settings/document-template/FooterSection';
import { DocumentPaper } from '@/components/molecules/settings/document-template/DocumentPaper';
import { DOCUMENT_DEFINITIONS } from '@/components/molecules/settings/document-template/documentRegistry';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

/**
 * Document template studio — collapsible form sections on the left, a live A4
 * preview on the right. Layout settings and the watermark are saved on the
 * tenant's document template; the logo, signature image and signatory live on
 * the document profile. Image uploads save immediately; everything else saves
 * with the Save button.
 */
export function DocumentTemplateStudio() {
  const user = useAuthStore((state) => state.user);
  const tenantId = user?.tenantId;
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const toast = useToast();

  const profileQuery = useTenantDocumentProfile(canManage ? tenantId : undefined);
  const templateQuery = useTenantDocumentTemplate(canManage ? tenantId : undefined);
  const profile = profileQuery.data;
  const saved = templateQuery.data;

  const saveTemplate = useSaveTenantDocumentTemplate(tenantId ?? '');
  const updateProfile = useUpdateTenantDocumentProfile(tenantId ?? '');
  const uploadLogo = useUploadTenantDocumentAsset(tenantId ?? '', 'logo');
  const uploadSignature = useUploadTenantDocumentAsset(tenantId ?? '', 'signature');
  const uploadWatermark = useUploadTenantDocumentWatermark(tenantId ?? '');
  const removeWatermark = useRemoveTenantDocumentWatermark(tenantId ?? '');

  const [template, setTemplate] = useState<DocumentTemplate>(DEFAULT_TEMPLATE);
  // Version of the template the editor was last loaded from or saved as.
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [baseline, setBaseline] = useState('');
  const initialised = useRef(false);

  // Dirty state is measured on the persisted fields only: layout config + signatory.
  const snapshot = useCallback(
    (value: DocumentTemplate) =>
      JSON.stringify([
        toTemplateConfig(value),
        value.signatoryName.trim(),
        value.signatoryTitle.trim(),
      ]),
    [],
  );

  useEffect(() => {
    if (initialised.current || !saved || !profile) return;
    initialised.current = true;
    const editor = toEditorTemplate(saved, profile, DEFAULT_TEMPLATE.previewDoc);
    setTemplate(editor);
    setLoadedVersion(saved.version);
    setBaseline(snapshot(editor));
  }, [saved, profile, snapshot]);

  // Uploaded/removed images come back through the queries; keep them on the preview.
  const images = serverImages(saved, profile);
  const preview = useMemo<DocumentTemplate>(
    () => ({ ...template, ...images }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, images.logo, images.signatureImage, images.watermarkImage],
  );

  const update = <K extends keyof DocumentTemplate>(key: K, value: DocumentTemplate[K]) =>
    setTemplate((prev) => ({ ...prev, [key]: value }));

  const runUpload = (
    label: string,
    mutate: (file: File, options: { onSuccess: () => void; onError: (e: unknown) => void }) => void,
    file: File,
  ) =>
    mutate(file, {
      onSuccess: () => toast.success(`${label} uploaded`),
      onError: (error) =>
        toast.error(errorMessage(error, `Failed to upload ${label.toLowerCase()}`)),
    });

  const assets: TemplateAssetHandlers = {
    uploadLogo: (file) => runUpload('Logo', uploadLogo.mutate, file),
    uploadSignature: (file) => runUpload('Signature', uploadSignature.mutate, file),
    uploadWatermark: (file) => runUpload('Watermark', uploadWatermark.mutate, file),
    removeWatermark: () =>
      removeWatermark.mutate(undefined, {
        onSuccess: () => toast.success('Watermark removed'),
        onError: (error) => toast.error(errorMessage(error, 'Failed to remove watermark')),
      }),
    busy: uploadLogo.isPending
      ? 'logo'
      : uploadSignature.isPending
        ? 'signature'
        : uploadWatermark.isPending || removeWatermark.isPending
          ? 'watermark'
          : null,
  };

  const isDirty = baseline !== '' && snapshot(template) !== baseline;
  const isSaving = saveTemplate.isPending || updateProfile.isPending;

  const handleSave = async () => {
    if (loadedVersion === null) return;
    try {
      // Uploads bump the stored version, so always send the freshest one we know.
      const current = saved?.version ?? loadedVersion;
      const result = await saveTemplate.mutateAsync({
        config: toTemplateConfig(template),
        expectedVersion: current,
      });
      if (hasSignatoryChanges(template, profile)) {
        await updateProfile.mutateAsync({
          authorizedSignatoryName: template.signatoryName.trim() || null,
          authorizedSignatoryTitle: template.signatoryTitle.trim() || null,
        });
      }
      setLoadedVersion(result.version);
      setBaseline(snapshot(template));
      toast.success('Document template saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save document template'));
    }
  };

  if (!canManage || !tenantId) {
    return (
      <div className="max-w-2xl py-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Document template</h3>
          <p className="mt-2 text-sm text-gray-500">
            Only tenant administrators can manage the document template.
          </p>
        </div>
      </div>
    );
  }

  if (profileQuery.isError || templateQuery.isError) {
    return (
      <div className="max-w-2xl py-6">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          Could not load the document template. Refresh the page to try again.
        </div>
      </div>
    );
  }

  if (loadedVersion === null) {
    return <div className="py-6 text-sm text-gray-500">Loading document template…</div>;
  }

  return (
    <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-4">
        <LetterheadSection template={preview} onChange={update} assets={assets} />
        <WatermarkSection template={preview} onChange={update} assets={assets} />
        <SignatureSection template={preview} onChange={update} assets={assets} />
        <FooterSection template={preview} onChange={update} />

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save template
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-2 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Live preview</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            {isDirty ? 'Unsaved changes' : loadedVersion === 0 ? 'Not saved yet' : 'Saved'}
          </span>
        </div>

        {/* Pick which document the preview shows — sample data, just for previewing. */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {DOCUMENT_DEFINITIONS.map((doc) => {
            const selected = template.previewDoc === doc.key;
            return (
              <button
                key={doc.key}
                type="button"
                aria-pressed={selected}
                onClick={() => update('previewDoc', doc.key)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  selected
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {doc.label}
              </button>
            );
          })}
        </div>

        <DocumentPaper template={preview} />
      </div>
    </div>
  );
}
