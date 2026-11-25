'use client';

import { DocumentContentLayout } from './DocumentContentLayout';
import { getDocumentDefinition } from './documentRegistry';
import type { DocumentTemplate } from './templateConfig';

/** The studio's content area — the chosen document's body with sample data. */
export function DocumentBody({ template }: { template: DocumentTemplate }) {
  const definition = getDocumentDefinition(template.previewDoc);

  return (
    <DocumentContentLayout
      template={template}
      documentKey={template.previewDoc}
      footerNote={definition.renderFooterNote?.()}
    >
      {definition.renderSample(template)}
    </DocumentContentLayout>
  );
}
