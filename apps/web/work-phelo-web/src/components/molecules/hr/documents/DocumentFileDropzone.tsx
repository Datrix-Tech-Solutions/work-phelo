'use client';

import { useRef, useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/components/organisms/hr/documents/types';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const HINT = 'PDF, image, Word or Excel file · up to 15 MB';

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function DocumentFileDropzone({ file, onFileChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setError('That file is over 15 MB. Pick a smaller one.');
      return;
    }
    setError(null);
    onFileChange(picked);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-6 text-center transition-colors',
          dragging ? 'border-brand bg-brand/5' : 'border-gray-300 bg-gray-50',
        )}
      >
        {file ? (
          <div className="flex items-center gap-2 w-full max-w-full">
            <FileText className="w-5 h-5 text-gray-500 shrink-0" />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud className="w-6 h-6 text-gray-400" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-input border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Choose file
            </button>
            <p className="text-xs text-gray-400">
              Drag a file here, or <span className="text-gray-500">browse</span>. {HINT}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
