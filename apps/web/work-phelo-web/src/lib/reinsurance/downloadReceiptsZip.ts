import { renderPrintRootToPdf, stagePrintRoot } from './renderDocumentPdf';

export interface ZipReceiptTarget {
  /** id of the hidden `DocumentPrintLayout` portal root for this document. */
  rootId: string;
  /** File name inside the zip, without the `.pdf` extension. */
  fileName: string;
  /** Title embedded in the generated PDF. */
  title: string;
}

export async function downloadReceiptsZip(
  targets: ZipReceiptTarget[],
  zipFileName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (targets.length === 0) return;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (let i = 0; i < targets.length; i++) {
    const { rootId, fileName, title } = targets[i];
    const el = document.getElementById(rootId);
    if (el) {
      const restore = stagePrintRoot(el);
      try {
        const blob = await renderPrintRootToPdf(el, title);
        let name = `${fileName}.pdf`;
        let n = 2;
        while (usedNames.has(name)) name = `${fileName} (${n++}).pdf`;
        usedNames.add(name);
        zip.file(name, blob);
      } finally {
        restore();
      }
    }
    onProgress?.(i + 1, targets.length);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFileName.endsWith('.zip') ? zipFileName : `${zipFileName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
