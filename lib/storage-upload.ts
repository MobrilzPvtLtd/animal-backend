import { supabaseAdmin } from '@/lib/server-supabase';

export const ANIMAL_IMAGE_BUCKET = 'animalclickposts';

let bucketEnsured = false;

export function extractAnimalImagePathFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    const bucketIndex = pathParts.findIndex((part) => part === ANIMAL_IMAGE_BUCKET);

    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join('/');
    }

    return null;
  } catch {
    return null;
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isBucketNotFound(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('not found') || m.includes('does not exist') || m.includes('bucket not found');
}

export async function ensureAnimalImageBucketExists() {
  if (bucketEnsured) return;

  try {
    const { error: getError } = await supabaseAdmin.storage.getBucket(ANIMAL_IMAGE_BUCKET);
    if (!getError) {
      bucketEnsured = true;
      return;
    }
  } catch {
    // Ignore and attempt create
  }

  try {
    const { error: createError } = await supabaseAdmin.storage.createBucket(ANIMAL_IMAGE_BUCKET, {
      public: true,
    });
    if (!createError || createError.message?.toLowerCase().includes('already exists')) {
      bucketEnsured = true;
      return;
    }
  } catch {
    // Ignore and proceed with upload
  }

  bucketEnsured = true;
}

export async function uploadAnimalImage(file: File, folder = 'uploads') {
  await ensureAnimalImageBucketExists();

  const sanitizedFolder = folder.replace(/(^\/+|\/+?$)/g, '');
  const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const path = `${sanitizedFolder}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage.from(ANIMAL_IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    if (isBucketNotFound(uploadError.message)) {
      bucketEnsured = false;
      await ensureAnimalImageBucketExists();

      const retryPath = `${sanitizedFolder}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error: retryError } = await supabaseAdmin.storage.from(ANIMAL_IMAGE_BUCKET).upload(retryPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

      if (retryError) {
        throw new Error(retryError.message);
      }

      const { data: retryUrlData } = supabaseAdmin.storage.from(ANIMAL_IMAGE_BUCKET).getPublicUrl(retryPath);
      if (!retryUrlData?.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded image');
      }

      return { url: retryUrlData.publicUrl, path: retryPath };
    } else {
      throw new Error(uploadError.message);
    }
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(ANIMAL_IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData?.publicUrl;

  if (!publicUrl) {
    throw new Error('Failed to generate public URL for uploaded image');
  }

  return {
    url: publicUrl,
    path,
  };
}

export async function deleteAnimalImageByUrl(url: string) {
  const filePath = extractAnimalImagePathFromUrl(url);

  if (!filePath) {
    return;
  }

  const { error } = await supabaseAdmin.storage.from(ANIMAL_IMAGE_BUCKET).remove([filePath]);

  if (error && !error.message.toLowerCase().includes('not found')) {
    throw new Error(`Failed to delete image file: ${error.message}`);
  }
}
