'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoPickerProps {
  currentUrl?: string | null;
  onFileChange?: (file: File | null) => void;
}

export function LogoPicker({ currentUrl, onFileChange }: LogoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const displayUrl = localPreview ?? currentUrl ?? null;

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setLocalPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    onFileChange?.(file);
  };

  const handleRemove = () => {
    setLocalPreview(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
    onFileChange?.(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={() => !displayUrl && inputRef.current?.click()}
        className={cn(
          'relative w-48 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors',
          displayUrl
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer',
        )}
      >
        {displayUrl ? (
          <>
            <Image src={displayUrl} alt="Company logo" fill className="object-contain p-2" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 shadow-sm"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Upload className="w-5 h-5" />
            <span className="text-xs">Upload logo</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm font-medium text-brand hover:underline"
        >
          {displayUrl ? 'Change logo' : 'Choose file'}
        </button>
        {fileName && <span className="text-xs text-gray-400 truncate max-w-40">{fileName}</span>}
      </div>

      <p className="text-xs text-gray-400">PNG, JPG or SVG · Max 2 MB · Recommended 280×90 px</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
