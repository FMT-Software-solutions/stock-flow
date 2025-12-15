import { Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

type UploadVariant = 'default' | 'compact';

interface ModernFileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  maxSize?: number; // in MB
  className?: string;
  children?: React.ReactNode;
  variant?: UploadVariant;
  multiple?: boolean;
  onFilesSelect?: (files: File[]) => void;
}

export function ModernFileUpload({
  onFileSelect,
  accept = 'image/*',
  disabled = false,
  maxSize = 2,
  className,
  children,
  variant = 'default',
  multiple = false,
  onFilesSelect,
}: ModernFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        return `File size must be less than ${maxSize}MB`;
      }

      // Check file type
      const acceptedTypes = accept.split(',').map((type) => type.trim());
      const isValidType = acceptedTypes.some((type) => {
        if (type === 'image/*') {
          return file.type.startsWith('image/');
        }
        return (
          file.type === type ||
          file.name.toLowerCase().endsWith(type.replace('*', ''))
        );
      });

      if (!isValidType) {
        return 'Invalid file type';
      }

      return null;
    },
    [accept, maxSize]
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect, validateFile]
  );

  const handleFilesSelect = useCallback(
    (files: File[]) => {
      setError(null);
      const validFiles: File[] = [];
      for (const file of files) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
        validFiles.push(file);
      }

      if (onFilesSelect) {
        onFilesSelect(validFiles);
      } else if (validFiles.length > 0) {
        onFileSelect(validFiles[0]);
      }
    },
    [onFilesSelect, onFileSelect, validateFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        if (multiple) {
          handleFilesSelect(files);
        } else {
          handleFileSelect(files[0]);
        }
      }
    },
    [disabled, handleFileSelect, handleFilesSelect, multiple]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        if (multiple) {
          handleFilesSelect(Array.from(files));
        } else {
          handleFileSelect(files[0]);
        }
      }
      // Clear the input
      e.target.value = '';
    },
    [handleFileSelect, handleFilesSelect, multiple]
  );

  const clearError = () => setError(null);

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg transition-colors cursor-pointer',
          'hover:border-primary/50 hover:bg-accent/5',
          isDragOver && 'border-primary bg-accent/30',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive',
          variant === 'default' ? 'p-6' : 'p-4'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        {variant === 'default' ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                'bg-primary/10 text-primary'
              )}
            >
              <Upload className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragOver
                  ? 'Drop your file here'
                  : 'Drag & drop your file here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs font-medium"
                  disabled={disabled}
                >
                  browse files
                </Button>
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Max {maxSize}MB • {accept.replace(/image\//g, '').toUpperCase()}
            </p>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                'bg-primary/10 text-primary'
              )}
            >
              <Upload className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {isDragOver ? 'Drop your file here' : 'Drag & drop file here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs font-medium"
                  disabled={disabled}
                >
                  browse files
                </Button>{' '}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Max {maxSize}MB
              </p>
            </div>
          </div>
        )}

        {children}
      </div>

      {error && (
        <div className="flex items-center justify-between bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="h-auto p-1 text-destructive hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
