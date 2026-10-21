'use client';

import { Input } from '@/components/atoms/Input';
import { Toggle } from '@/components/atoms/Toggle';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { CollapsibleCard } from '@/components/atoms/CollapsibleCard';
import { ImageUploadField } from '@/components/atoms/ImageUploadField';
import { useToast } from '@/hooks/useToast';
import { DOCUMENT_DEFINITIONS } from './documentRegistry';
import {
  SIGNATURE_POSITION_OPTIONS,
  type DocumentTemplate,
  type PreviewDoc,
  type TemplateAssetHandlers,
} from './templateConfig';

const SIGNATURE_MAX_BYTES = 1024 * 1024;
const SIGNATURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface SignatureSectionProps {
  template: DocumentTemplate;
  onChange: <K extends keyof DocumentTemplate>(key: K, value: DocumentTemplate[K]) => void;
  assets: TemplateAssetHandlers;
}

export function SignatureSection({ template, onChange, assets }: SignatureSectionProps) {
  const toast = useToast();

  const toggleRule = (doc: PreviewDoc, value: boolean) =>
    onChange('signatureRules', { ...template.signatureRules, [doc]: value });

  return (
    <CollapsibleCard
      title="Signature"
      description="A signature block at the bottom of the documents you choose."
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-gray-900">Enable signature</span>
          <Toggle
            enabled={template.signatureEnabled}
            onChange={(value) => onChange('signatureEnabled', value)}
          />
        </div>

        {template.signatureEnabled && (
          <>
            <ImageUploadField
              label="Signature image"
              hint="Transparent PNG works best · max 1 MB"
              value={template.signatureImage}
              onFile={assets.uploadSignature}
              busy={assets.busy === 'signature'}
              accept="image/png,image/jpeg,image/webp"
              allowedTypes={SIGNATURE_TYPES}
              maxBytes={SIGNATURE_MAX_BYTES}
              onError={(message) => toast.error(message)}
            />
            <Input
              label="Signatory name"
              value={template.signatoryName}
              onChange={(event) => onChange('signatoryName', event.target.value)}
            />
            <Input
              label="Signatory title"
              value={template.signatoryTitle}
              onChange={(event) => onChange('signatoryTitle', event.target.value)}
            />

            <div>
              <span className="text-sm font-bold text-gray-900">Position</span>
              <div className="mt-1">
                <SegmentedToggle
                  value={template.signaturePosition}
                  onChange={(value) => onChange('signaturePosition', value)}
                  options={SIGNATURE_POSITION_OPTIONS}
                />
              </div>
            </div>

            <div>
              <span className="text-sm font-bold text-gray-900">Show on</span>
              <div className="mt-2 flex flex-col gap-2">
                {DOCUMENT_DEFINITIONS.map((option) => (
                  <div
                    key={option.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <span className="text-sm text-gray-700">{option.label}</span>
                    <Toggle
                      enabled={template.signatureRules[option.key]}
                      onChange={(value) => toggleRule(option.key, value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}
