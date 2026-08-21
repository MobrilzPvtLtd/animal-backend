import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { uploadAnimalImage } from '@/lib/storage-upload';

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, any> = {};
    const uploadedUrls: string[] = [];
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      for (const [key, value] of Array.from(formData.entries())) {
        if (typeof value === 'object' && (value as any) instanceof File) {
          try {
            const { url } = await uploadAnimalImage(value as File, 'pet-friendly-places');
            uploadedUrls.push(url);
          } catch (e) {
            console.error('File upload error in contribute place API:', e);
          }
        } else {
          body[key] = value;
        }
      }
    } else {
      body = await request.json().catch(() => ({}));
    }

    const {
      name,
      place_type,
      category,
      address,
      description,
      phone,
      website,
      latitude,
      longitude,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Place name is required' }, { status: 400 });
    }

    if (!address || typeof address !== 'string' || !address.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const imageUrl = uploadedUrls.length > 0 ? uploadedUrls[0] : (body.image_url || null);
    const images = uploadedUrls.length > 0 ? uploadedUrls : (body.images ? [body.images].flat() : []);

    const placeType = place_type || category || 'General';

    const insertData: Record<string, any> = {
      name: name.trim(),
      description: description ? description.trim() : null,
      address: address.trim(),
      phone: phone ? phone.trim() : null,
      website: website ? website.trim() : null,
      latitude: latitude ? parseFloat(latitude.toString()) : null,
      longitude: longitude ? parseFloat(longitude.toString()) : null,
      image_url: imageUrl,
      images: images,
      place_type: placeType,
      is_approved: false,
      show_publicly: false,
      is_verified: false,
      rating: 0,
    };

    const { data, error } = await supabaseAdmin
      .from('pet_friendly_places')
      .insert([insertData])
      .select('*')
      .single();

    if (error) {
      console.error('Error inserting contributed place:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Place contribution submitted successfully for admin review.',
        place: data,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unhandled error in places contribution:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit place contribution' },
      { status: 500 }
    );
  }
}
