import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ImagePreviewProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  previewSrc?: string;
}

export function ImagePreview({
  src,
  alt,
  className,
  previewSrc,
  ...props
}: ImagePreviewProps) {
  if (!src) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <img
          src={src}
          alt={alt}
          className={cn(
            'cursor-pointer hover:opacity-90 transition-opacity',
            className
          )}
          {...props}
        />
      </DialogTrigger>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-transparent border-none shadow-none flex items-center justify-center"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">Image Preview: {alt}</DialogTitle>
        <img
          src={previewSrc || src}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-lg"
        />
      </DialogContent>
    </Dialog>
  );
}
