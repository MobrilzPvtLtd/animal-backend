import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { uploadAnimalImage } from '@/lib/storage-upload';

type AnimalTypePayload = {
  name?: unknown;
  image_url?: unknown;
  imageUrl?: unknown;
  images?: unknown;
  file?: unknown;
};

async function readPayload(request: NextRequest): Promise<AnimalTypePayload> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();

    return {
      name: formData.get('name'),
      image_url: formData.get('image_url') ?? formData.get('file'),
      imageUrl: formData.get('imageUrl'),
      images: formData.get('images'),
      file: formData.get('file'),
    };
  }

  try {
    return (await request.json()) as AnimalTypePayload;
  } catch {
    return {};
  }
}

async function resolveImageUrl(payload: AnimalTypePayload): Promise<string | null> {
  const rawImageValue = payload.image_url ?? payload.imageUrl ?? payload.file;

  if (rawImageValue instanceof File) {
    const uploadResult = await uploadAnimalImage(rawImageValue, 'animal-types');
    return uploadResult.url;
  }

  if (typeof rawImageValue === 'string' && rawImageValue.trim()) {
    return rawImageValue.trim();
  }

  return null;
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  let query = supabaseAdmin.from('animal_types').select('*').order('name');

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data || []).map((type: any) => ({
    ...type,
    images: Array.isArray(type.images) && type.images.length > 0 ? type.images : (type.image_url ? [type.image_url] : []),
  }));

  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const body = await readPayload(request);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const image_url = await resolveImageUrl(body);

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  let images: string[] = [];
  if (Array.isArray(body.images)) {
    images = body.images.filter((img): img is string => typeof img === 'string');
  } else if (typeof body.images === 'string') {
    try {
      const parsed = JSON.parse(body.images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      images = [body.images];
    }
  }

  if (images.length === 0 && image_url) {
    images = [image_url];
  }

  const { data, error } = await supabaseAdmin
    .from('animal_types')
    .insert([{ name, image_url: images[0] || image_url || null, images }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}