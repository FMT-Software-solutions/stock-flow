import { supabase } from './supabase';

export interface AttachmentUploadResult {
  url: string;
  path: string;
}

// File validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
];
const CLOUDINARY_FOLDER = 'stockflow-expenses-attachements';

function validateFile(file: File): { isValid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Only images and PDFs are allowed.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { isValid: true };
}


/**
 * Uploads an attachment file to Cloudinary via Supabase Edge Function
 * @param file - The file to upload
 * @param organizationId - The organization ID (kept for interface consistency)
 * @returns Promise with upload result or throws error
 */
export async function uploadAttachment(
  file: File,
  organizationId: string
): Promise<AttachmentUploadResult> {
  // Validate inputs
  if (!organizationId || organizationId.trim() === '') {
    throw new Error('Organization ID is required for upload');
  }

  // Validate file first
  const validation = validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', CLOUDINARY_FOLDER);

    const { data, error } = await supabase.functions.invoke('cloudinary-upload', {
      body: formData,
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data || !data.secure_url) {
      throw new Error('Upload successful but no URL returned');
    }

    return {
      url: data.secure_url,
      path: data.public_id,
    };
  } catch (error) {
    console.error('Attachment upload error:', error);
    throw error instanceof Error ? error : new Error('Upload failed');
  }
}
