import { useState, useCallback, useRef, DragEvent } from 'react';
import { Upload, X, File, Check, AlertCircle, Loader2, Image } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface FileItem {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileDropZoneProps {
  onFilesSelected: (files: File[], onProgress: (id: string, progress: number, status: 'uploading' | 'completed' | 'error', error?: string) => void) => void;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
}

export function FileDropZone({
  onFilesSelected,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  disabled = false,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (fileList: FileList | File[]): { valid: File[]; errors: string[] } => {
      const validFiles: File[] = [];
      const errors: string[] = [];
      const filesArray = Array.from(fileList);

      if (filesArray.length + files.filter(f => f.status !== 'completed').length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return { valid: [], errors };
      }

      for (const file of filesArray) {
        if (maxSize && file.size > maxSize) {
          errors.push(`"${file.name}" exceeds ${formatFileSize(maxSize)}`);
          continue;
        }

        if (accept && accept !== '*/*') {
          const acceptTypes = accept.split(',').map((t) => t.trim().toLowerCase());
          const fileExt = file.name.split('.').pop()?.toLowerCase();
          const fileType = file.type.toLowerCase();

          const isValidType = acceptTypes.some((type) => {
            if (type === '*/*') return true;
            if (type.startsWith('.')) return `.${fileExt}` === type;
            if (type.endsWith('/*')) return fileType.startsWith(type.replace('/*', '/'));
            return fileType === type;
          });

          if (!isValidType) {
            errors.push(`"${file.name}" is not an accepted file type`);
            continue;
          }
        }

        validFiles.push(file);
      }

      return { valid: validFiles, errors };
    },
    [accept, maxSize, maxFiles, files]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setError(null);

      if (disabled || isUploading) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        const { valid, errors } = validateFiles(droppedFiles);
        if (errors.length > 0) {
          setError(errors[0]);
        }
        if (valid.length > 0) {
          const newFiles: FileItem[] = valid.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            progress: 0,
            status: 'pending',
          }));
          setFiles((prev) => [...prev, ...newFiles]);
          setIsUploading(true);

          // Call the callback with progress updater
          const onProgress = (id: string, progress: number, status: 'uploading' | 'completed' | 'error', err?: string) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id ? { ...f, progress, status, error: err } : f
              )
            );
          };

          onFilesSelected(valid, onProgress);
        }
      }
    },
    [disabled, isUploading, validateFiles, onFilesSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      if (e.target.files && e.target.files.length > 0) {
        const { valid, errors } = validateFiles(e.target.files);
        if (errors.length > 0) {
          setError(errors[0]);
        }
        if (valid.length > 0) {
          const newFiles: FileItem[] = valid.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            progress: 0,
            status: 'pending',
          }));
          setFiles((prev) => [...prev, ...newFiles]);
          setIsUploading(true);

          // Call the callback with progress updater
          const onProgress = (id: string, progress: number, status: 'uploading' | 'completed' | 'error', err?: string) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id ? { ...f, progress, status, error: err } : f
              )
            );
          };

          onFilesSelected(valid, onProgress);
        }
      }
      e.target.value = '';
    },
    [validateFiles, onFilesSelected]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setError(null);
    setIsUploading(false);
  }, [files]);

  const completedCount = files.filter(f => f.status === 'completed').length;
  const hasErrors = files.some(f => f.status === 'error');
  const allCompleted = files.length > 0 && files.every(f => f.status === 'completed' || f.status === 'error');

  // Update isUploading when all files are done
  if (allCompleted && isUploading) {
    setTimeout(() => setIsUploading(false), 500);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer relative',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400',
          (disabled || isUploading) && 'opacity-50 cursor-not-allowed'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      >
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          accept={accept}
          multiple
          onChange={handleFileInput}
          disabled={disabled || isUploading}
        />

        <div className="flex flex-col items-center">
          <div className={clsx(
            'w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors',
            isDragging ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800'
          )}>
            <Upload className={clsx('w-8 h-8', isDragging ? 'text-blue-500' : 'text-gray-400')} />
          </div>
          <p className="text-base font-medium text-gray-700 dark:text-gray-200 mb-1">
            {isDragging ? (
              <span className="text-blue-600 dark:text-blue-400">Drop files here</span>
            ) : (
              <>
                <span className="text-blue-600 dark:text-blue-400">Click to upload</span>
                {' '}or drag and drop
              </>
            )}
          </p>
          <p className="text-sm text-gray-500">
            {accept && accept !== '*/*'
              ? `Accepted: ${accept}`
              : 'Images, PDFs, Office documents, and more'}
            {' | '}Max {formatFileSize(maxSize)} per file
            {maxFiles > 1 && ` | Up to ${maxFiles} files`}
          </p>
        </div>

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center pointer-events-none">
            <span className="text-blue-600 dark:text-blue-400 font-medium text-lg">Drop to upload</span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Upload status summary */}
      {files.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {allCompleted ? (
              hasErrors ? (
                <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Upload completed with errors
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  All {completedCount} files uploaded
                </span>
              )
            ) : (
              <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading {completedCount}/{files.length} files...
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              clearFiles();
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* File list with progress */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {files.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              {/* Preview */}
              {item.preview ? (
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                  {item.file.type.startsWith('image/') ? (
                    <Image className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <File className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {item.file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{formatFileSize(item.file.size)}</span>
                  {item.status === 'error' && item.error && (
                    <span className="text-xs text-red-500 truncate">{item.error}</span>
                  )}
                </div>

                {/* Progress bar */}
                {(item.status === 'uploading' || item.status === 'completed') && (
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={clsx(
                        'h-full transition-all duration-300 rounded-full',
                        item.status === 'completed'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                      )}
                      style={{ width: item.status === 'completed' ? '100%' : `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {item.status === 'pending' && (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                )}
                {item.status === 'uploading' && (
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                )}
                {item.status === 'completed' && (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                {item.status === 'error' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(item.id);
                    }}
                    className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
