import { FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentFileKind } from '@/components/organisms/hr/documents/types';

const ICONS: Record<DocumentFileKind, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  image: ImageIcon,
  spreadsheet: FileSpreadsheet,
  other: FileIcon,
};

export function DocumentFileIcon({
  kind,
  className,
}: {
  kind: DocumentFileKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon className={cn('shrink-0', className)} />;
}
