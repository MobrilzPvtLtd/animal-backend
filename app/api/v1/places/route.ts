import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { requireRoles } from '@/lib/server-auth';
import { uploadAnimalImage } from '@/lib/storage-upload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const includeDeleted = request.nextUrl.searchParams.get('include_deleted');

  let query = supabaseAdmin
    .from('pet_friendly_places')
    .select(`*, place_groups(group:groups(*)), service_provider:service_providers(*)`)
    .order('name');

  if (!includeDeleted) {
    query = query.eq('is_deleted', false);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ places: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  let body: any = {};
  const uploadedUrls: string[] = [];
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    for (const [key, value] of Array.from(formData.entries())) {
      if (typeof value === 'object' && (value as any) instanceof File) {
        try {
          const { url } = await uploadAnimalImage(value, 'pet-friendly-places');
          uploadedUrls.push(url);
        } catch (e) {
          console.error('File upload error in places POST:', e);
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
    description,
    image_url,
    images,
    phone,
    email,
    website,
    rating = 0,
    is_verified = false,
    operating_hours,
    amenities,
    pet_policy,
    address,
    latitude,
    longitude,
    show_publicly = true,
    group_id,
    service_provider_id,
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'Place name is required' }, { status: 400 });
  }

  // Parse images array from body if provided
  let imageList: string[] = [];
  if (Array.isArray(images)) {
    imageList = images.filter((img): img is string => typeof img === 'string');
  } else if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) {
        imageList = parsed.filter((img): img is string => typeof img === 'string');
      } else {
        imageList = [images];
      }
    } catch {
      imageList = images.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Append any uploaded file URLs
  if (uploadedUrls.length > 0) {
    imageList = [...imageList, ...uploadedUrls];
  }

  // Fallback to image_url if imageList is empty
  if (imageList.length === 0 && typeof image_url === 'string' && image_url.trim()) {
    imageList = [image_url.trim()];
  }

  const finalImageUrl = imageList[0] || (typeof image_url === 'string' ? image_url : null);

  // Coerce types
  const finalRating = typeof rating === 'string' ? parseInt(rating, 10) || 0 : (rating ?? 0);
  const finalIsVerified = is_verified === true || is_verified === 'true' || is_verified === 1;
  const finalShowPublicly = show_publicly === true || show_publicly === 'true' || show_publicly === 1;

  let finalAmenities = amenities ?? null;
  if (typeof finalAmenities === 'string') {
    finalAmenities = finalAmenities.split(',').map((s: string) => s.trim()).filter(Boolean);
  } else if (Array.isArray(finalAmenities) && finalAmenities.length === 0) {
    finalAmenities = null;
  }

  let finalHours = operating_hours ?? null;
  if (typeof finalHours === 'string') {
    try { finalHours = JSON.parse(finalHours); } catch {}
  }

  const insertData: any = {
    name,
    description: description || null,
    image_url: finalImageUrl || null,
    images: imageList,
    phone: phone || null,
    email: email || null,
    website: website || null,
    rating: finalRating,
    is_verified: finalIsVerified,
    address: address || null,
    latitude: latitude ? parseFloat(latitude.toString()) : null,
    longitude: longitude ? parseFloat(longitude.toString()) : null,
    show_publicly: finalShowPublicly,
    operating_hours: finalHours,
    amenities: finalAmenities,
    pet_policy: pet_policy || null,
    service_provider_id: service_provider_id ? Number(service_provider_id) : null,
  };

  const { data, error } = await supabaseAdmin
    .from('pet_friendly_places')
    .insert([insertData])
    .select('pet_friendly_place_id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to create place' }, { status: 500 });
  }

  const placeId = data.pet_friendly_place_id;

  // Insert group mapping if group_id provided
  if (group_id) {
    await supabaseAdmin
      .from('place_groups')
      .insert([{ place_id: placeId, group_id: Number(group_id) }]);
  }

  const { data: createdPlace } = await supabaseAdmin
    .from('pet_friendly_places')
    .select(`*, place_groups(group:groups(*)), service_provider:service_providers(*)`)
    .eq('pet_friendly_place_id', placeId)
    .single();

  return NextResponse.json({ place: createdPlace });
}

export async function PUT(request: NextRequest) {
  return PATCH(request);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  const placeId = request.nextUrl.searchParams.get('place_id');
  if (!placeId) {
    return NextResponse.json({ error: 'place_id is required' }, { status: 400 });
  }

  let body: any = {};
  const uploadedUrls: string[] = [];
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    for (const [key, value] of Array.from(formData.entries())) {
      if (typeof value === 'object' && (value as any) instanceof File) {
        try {
          const { url } = await uploadAnimalImage(value, 'pet-friendly-places');
          uploadedUrls.push(url);
        } catch (e) {
          console.error('File upload error in places PATCH:', e);
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
    description,
    image_url,
    images,
    phone,
    email,
    website,
    rating,
    is_verified,
    operating_hours,
    amenities,
    pet_policy,
    address,
    latitude,
    longitude,
    show_publicly,
    group_id,
    service_provider_id,
  } = body;

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  // Process images
  if (images !== undefined || uploadedUrls.length > 0 || image_url !== undefined) {
    let imageList: string[] = [];
    if (Array.isArray(images)) {
      imageList = images.filter((img): img is string => typeof img === 'string');
    } else if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          imageList = parsed.filter((img): img is string => typeof img === 'string');
        } else {
          imageList = [images];
        }
      } catch {
        imageList = images.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (uploadedUrls.length > 0) {
      imageList = [...imageList, ...uploadedUrls];
    }

    if (imageList.length === 0 && typeof image_url === 'string' && image_url.trim()) {
      imageList = [image_url.trim()];
    }

    updates.images = imageList;
    if (imageList.length > 0) {
      updates.image_url = imageList[0];
    } else if (image_url !== undefined) {
      updates.image_url = typeof image_url === 'string' ? image_url : null;
    }
  }

  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (website !== undefined) updates.website = website;
  if (rating !== undefined) updates.rating = typeof rating === 'string' ? parseInt(rating, 10) || 0 : rating;
  if (is_verified !== undefined) updates.is_verified = is_verified === true || is_verified === 'true' || is_verified === 1;

  if (operating_hours !== undefined) {
    let finalHours = operating_hours;
    if (typeof finalHours === 'string') {
      try { finalHours = JSON.parse(finalHours); } catch {}
    }
    updates.operating_hours = finalHours;
  }

  if (address !== undefined) updates.address = address;
  if (latitude !== undefined) updates.latitude = latitude ? parseFloat(latitude.toString()) : null;
  if (longitude !== undefined) updates.longitude = longitude ? parseFloat(longitude.toString()) : null;
  if (show_publicly !== undefined) updates.show_publicly = show_publicly === true || show_publicly === 'true' || show_publicly === 1;
  if (service_provider_id !== undefined) updates.service_provider_id = service_provider_id ? Number(service_provider_id) : null;

  if (amenities !== undefined) {
    updates.amenities = typeof amenities === 'string'
      ? amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
      : Array.isArray(amenities) && amenities.length === 0 ? null : amenities;
  }
  if (pet_policy !== undefined) updates.pet_policy = pet_policy;

  const { error } = await supabaseAdmin
    .from('pet_friendly_places')
    .update(updates)
    .eq('pet_friendly_place_id', placeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update place_groups if group_id provided
  if (group_id !== undefined) {
    await supabaseAdmin
      .from('place_groups')
      .delete()
      .eq('place_id', placeId);

    if (group_id) {
      await supabaseAdmin
        .from('place_groups')
        .insert([{ place_id: Number(placeId), group_id: Number(group_id) }]);
    }
  }

  const { data: updatedPlace } = await supabaseAdmin
    .from('pet_friendly_places')
    .select(`*, place_groups(group:groups(*)), service_provider:service_providers(*)`)
    .eq('pet_friendly_place_id', placeId)
    .single();

  return NextResponse.json({ place: updatedPlace });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const placeId = request.nextUrl.searchParams.get('place_id');
  if (!placeId) {
    return NextResponse.json({ error: 'place_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('pet_friendly_places')
    .update({ is_deleted: true })
    .eq('pet_friendly_place_id', placeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Place deleted successfully' });
}
