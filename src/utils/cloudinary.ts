import { supabase } from './supabase';

export async function uploadImageToCloudinary(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'product-images'); // Optional folder

    const { data, error } = await supabase.functions.invoke('cloudinary-upload', {
        body: formData,
    });

    if (error) {
        throw error;
    }

    return data.secure_url;
}

export async function deleteImageFromCloudinary(url: string) {
    if (!url) return;
    
    // Simple extraction logic for Cloudinary public_id
    // URL format: https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<public_id>.<ext>
    // or without version.
    
    try {
        // We look for 'upload/' segment
        const parts = url.split('/upload/');
        if (parts.length < 2) return;
        
        let path = parts[1];
        // Remove version if present (v1234567890/)
        if (path.startsWith('v')) {
            const versionEnd = path.indexOf('/');
            if (versionEnd !== -1) {
                path = path.substring(versionEnd + 1);
            }
        }
        
        // Remove extension
        const lastDot = path.lastIndexOf('.');
        if (lastDot !== -1) {
            path = path.substring(0, lastDot);
        }
        
        const public_id = path;

        const { error } = await supabase.functions.invoke('cloudinary-delete', {
            body: { public_id }
        });
        
        if (error) {
            console.error('Error deleting image from Cloudinary:', error);
            // Silent fail
        }
    } catch (e) {
        console.error('Error in deleteImageFromCloudinary:', e);
        // Silent fail
    }
}
