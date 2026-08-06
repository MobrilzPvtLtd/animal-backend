import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DIMENSION = 1920;

function compressImage(file: File, quality = 0.8, maxDimension = MAX_DIMENSION): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context not available')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        mimeType,
        mimeType === 'image/png' ? undefined : quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

export class ImageUploadService {
  static async uploadImage(file: File, folder?: string): Promise<UploadResult> {
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      let processedFile = file;

      if (file.size > MAX_FILE_SIZE) {
        let compressed = await compressImage(file);
        let attempts = 0;
        while (compressed.size > MAX_FILE_SIZE && attempts < 3) {
          const q = Math.max(0.3, 0.8 - attempts * 0.2);
          compressed = await compressImage(file, q);
          attempts++;
        }
        if (compressed.size > MAX_FILE_SIZE && file.size > compressed.size) {
          compressed = await compressImage(file, 0.3, 1200);
        }
        if (compressed.size < file.size) {
          processedFile = new File([compressed], file.name, {
            type: compressed.type || file.type,
          });
        }
      }

      const formData = new FormData();
      formData.append('file', processedFile);
      if (folder) {
        formData.append('folder', folder);
      }

      const response = await fetch('/api/v1/upload-image', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to upload image');
      }

      return {
        url: payload.url,
        path: payload.path,
      };
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  }

  /**
   * Delete an image from Supabase storage
   */
  static async deleteImage(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from('animalclickposts')
        .remove([filePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Image delete error:', error);
      throw error;
    }
  }

  /**
   * Extract file path from a Supabase storage URL
   */
  static extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.findIndex(part => part === 'animalclickposts');
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Replace an existing image (delete old, upload new)
   */
  static async replaceImage(
    newFile: File, 
    oldImageUrl?: string, 
    folder?: string
  ): Promise<UploadResult> {
    try {
      // Upload new image first
      const uploadResult = await this.uploadImage(newFile, folder);

      // Delete old image if it exists and is from our bucket
      if (oldImageUrl) {
        const oldFilePath = this.extractFilePathFromUrl(oldImageUrl);
        if (oldFilePath) {
          try {
            await this.deleteImage(oldFilePath);
          } catch (error) {
            console.warn('Failed to delete old image:', error);
            // Don't throw here, as the new upload was successful
          }
        }
      }

      return uploadResult;
    } catch (error) {
      console.error('Image replace error:', error);
      throw error;
    }
  }
}
