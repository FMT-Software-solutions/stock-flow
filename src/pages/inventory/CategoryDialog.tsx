import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCreateCategory } from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { uploadImageToCloudinary } from '@/utils/cloudinary';

export function CategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const { currentOrganization } = useOrganization();
  const createCategory = useCreateCategory();

  const handleSave = async () => {
    if (!currentOrganization?.id || !name) return;
    
    try {
        await createCategory.mutateAsync({
            name,
            description,
            image: image || undefined,
            organizationId: currentOrganization.id
        });
        onOpenChange(false);
        // Reset form
        setName('');
        setDescription('');
        setImage(null);
    } catch (e) {
        console.error("Failed to create category", e);
    }
  };

  const handleImageUpload = async (file: File) => {
      try {
          setIsUploading(true);
          const url = await uploadImageToCloudinary(file);
          setImage(url);
      } catch (error) {
          console.error("Upload failed", error);
      } finally {
          setIsUploading(false);
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
          <DialogDescription>Create a new product category.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g., Electronics" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Category description..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Cover Image</Label>
            {image ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                <img
                  src={image}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() => setImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                  <ModernFileUpload
                    className="aspect-video"
                    onFileSelect={handleImageUpload}
                    disabled={isUploading}
                  />
                   {isUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                          <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                  )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave} disabled={isUploading || createCategory.isPending || !name}>
            {createCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
