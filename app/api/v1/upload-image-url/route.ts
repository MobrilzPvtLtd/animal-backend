import { NextRequest, NextResponse } from 'next/server';
import { uploadAnimalImageFromBuffer, ANIMAL_IMAGE_BUCKET } from '@/lib/storage-upload';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, folder: folderValue } = body || {};

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A valid image URL is required' }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return NextResponse.json({ error: 'A valid image URL is required' }, { status: 400 });
    }

    const folder = typeof folderValue === 'string' && folderValue.trim() ? folderValue.trim() : 'uploads';

    // If it's already an image in our Supabase bucket, return it directly
    if (trimmedUrl.includes(ANIMAL_IMAGE_BUCKET) && trimmedUrl.includes('supabase.co')) {
      return NextResponse.json({
        url: trimmedUrl,
        path: '',
        alreadyHosted: true,
      });
    }

    // Handle base64 Data URLs
    if (trimmedUrl.startsWith('data:image/')) {
      const match = trimmedUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ error: 'Invalid base64 image data URL' }, { status: 400 });
      }

      const mimeType = match[1].toLowerCase();
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const ext = MIME_TO_EXT[mimeType] || 'jpg';
      const fileName = `imported-image.${ext}`;

      const { url: publicUrl, path } = await uploadAnimalImageFromBuffer(
        buffer,
        fileName,
        mimeType,
        folder
      );

      return NextResponse.json({ url: publicUrl, path });
    }

    // Validate HTTP/HTTPS URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('URL must use http or https protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Fetch the image with a timeout and realistic browser headers
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(parsedUrl.href, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Image download timed out after 15 seconds. Please try uploading the image file directly.' },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: `Could not download image from the provided link (${fetchError?.message || 'Network error'})` },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Remote server returned HTTP ${response.status} (${response.statusText}). The link may have expired or requires authentication.`,
        },
        { status: 400 }
      );
    }

    const contentTypeHeader = response.headers.get('content-type') || '';
    const rawMime = contentTypeHeader.split(';')[0].trim().toLowerCase();

    // Ensure it's actually an image
    if (!rawMime.startsWith('image/') && rawMime !== 'application/octet-stream') {
      return NextResponse.json(
        {
          error: `The provided link points to "${rawMime || 'unknown'}" instead of a valid image file.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Max 50MB
    const maxSize = 50 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return NextResponse.json({ error: 'Image size exceeds the 50MB limit' }, { status: 400 });
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Downloaded image is empty (0 bytes)' }, { status: 400 });
    }

    // Determine filename and extension
    let mimeType = rawMime;
    let ext = MIME_TO_EXT[mimeType];

    if (!ext) {
      const pathname = parsedUrl.pathname;
      const lastDot = pathname.lastIndexOf('.');
      if (lastDot !== -1) {
        const potentialExt = pathname.substring(lastDot + 1).toLowerCase().split('?')[0];
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(potentialExt)) {
          ext = potentialExt === 'jpeg' ? 'jpg' : potentialExt;
          mimeType = `image/${ext === 'svg' ? 'svg+xml' : ext}`;
        }
      }
    }

    if (!ext) {
      ext = 'jpg';
      mimeType = 'image/jpeg';
    }

    const rawFileName = parsedUrl.pathname.split('/').pop() || 'imported-image';
    const cleanBaseName = rawFileName.split('.')[0] || 'imported-image';
    const fileName = `${cleanBaseName}.${ext}`;

    const { url: publicUrl, path } = await uploadAnimalImageFromBuffer(
      buffer,
      fileName,
      mimeType,
      folder
    );

    return NextResponse.json({
      url: publicUrl,
      path,
      originalUrl: trimmedUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download and upload image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
