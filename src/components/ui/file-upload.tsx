import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

export interface FileUploadProps {
  accept?: string;
  maxSizeBytes?: number;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onError?: (message: string) => void;
  label?: string;
  helperText?: string;
  className?: string;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileUpload({
  accept = '.csv,text/csv',
  maxSizeBytes = 2 * 1024 * 1024,
  selectedFile,
  onFileSelect,
  onError,
  label = 'Drop a CSV file here or click to browse',
  helperText = 'Supports .csv files up to 2 MB',
  className,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndAccept = (file: File | undefined | null) => {
    if (!file) return;

    const allowedExtensions = accept
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.startsWith('.'));

    if (allowedExtensions.length > 0) {
      const hasValidExtension = allowedExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
      if (!hasValidExtension && file.type !== 'text/csv') {
        onError?.(`Unsupported file type. Please select a ${allowedExtensions.join(', ')} file.`);
        return;
      }
    }

    if (file.size === 0) {
      onError?.('The selected file is empty.');
      return;
    }

    if (file.size > maxSizeBytes) {
      onError?.(`File exceeds the ${formatFileSize(maxSizeBytes)} limit.`);
      return;
    }

    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    validateAndAccept(e.dataTransfer.files?.[0]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileSelect(null);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => validateAndAccept(e.target.files?.[0])}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border-2 border-dashed p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer',
          isDragging
            ? 'border-blue-600 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-300 bg-slate-50/70 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0F2942] dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400">
            {selectedFile ? (
              <FileSpreadsheet className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {selectedFile ? selectedFile.name : label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {selectedFile
                ? `${formatFileSize(selectedFile.size)} · Ready to send to /api/admin/bulk-upload`
                : helperText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedFile ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Remove selected file"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          ) : (
            <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Browse CSV
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
