import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { ANIMAL_IMAGE_BUCKET, ensureAnimalImageBucketExists } from '@/lib/storage-upload';

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, folder: folderValue } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }

    if (!fileType.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    await ensureAnimalImageBucketExists();

    const sanitizedFolder = (folderValue || 'uploads').replace(/(^\/+|\/+?$)/g, '');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${sanitizedFolder}/${Date.now()}-${sanitizedFileName}`;

    const result = await supabaseAdmin.storage
      .from(ANIMAL_IMAGE_BUCKET)
      .createSignedUploadUrl(path);

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (!result.data) {
      throw new Error('Failed to generate signed upload URL');
    }

    const publicUrlData = supabaseAdmin.storage
      .from(ANIMAL_IMAGE_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      uploadUrl: result.data.signedUrl,
      publicUrl: publicUrlData.data.publicUrl,
      path,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
