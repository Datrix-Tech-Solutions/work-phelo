import { useFetchTenantDocumentRender } from '@/hooks/useTenantDocumentTemplate';
import { useToast } from '@/hooks/useToast';
import { buildDocumentTemplate } from '@/lib/accounting/documentTemplate';
import { useAuthStore } from '@/store/auth.store';

/** Loads the saved document template for a report download. If it can't be loaded the
 *  report still downloads, plain, and the user is told. */
export function useReportLetterhead() {
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const fetchRender = useFetchTenantDocumentRender();
  const toast = useToast();

  return async () => {
    if (!tenantId) return null;
    try {
      const render = await fetchRender(tenantId);
      return buildDocumentTemplate(render, { tenantId, version: Date.now() });
    } catch {
      toast.error('Could not load the document template, so the PDF has no letterhead');
      return null;
    }
  };
}
