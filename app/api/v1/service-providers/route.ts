import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { requireRoles } from '@/lib/server-auth';
import { uploadAnimalImage, deleteAnimalImageByUrl } from '@/lib/storage-upload';
import { syncServiceProviderToPetFriendlyPlace } from '@/lib/sync-pet-friendly-places';
import { resolveUserLocation, applyLocationFilterAndSort } from '@/lib/geo';

// Disable Next.js fetch cache so DB updates are immediately reflected
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const serviceCategoryId = request.nextUrl.searchParams.get('service_category_id');
  const search = request.nextUrl.searchParams.get('search');
  const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';
  const includeDeleted = request.nextUrl.searchParams.get('include_deleted') === 'true';

  let query = supabaseAdmin
    .from('service_providers')
    .select('*, locations(*), pet_friendly_places(latitude, longitude, address), service_categories!service_providers_service_category_id_fkey(*), service_provider_categories(service_category:service_categories(*)), service_provider_images(*)')
    .order('name');

  if (serviceCategoryId) {
    const catIdNum = Number(serviceCategoryId);
    const { data: junctionRows } = await supabaseAdmin
      .from('service_provider_categories')
      .select('service_provider_id')
      .eq('service_category_id', catIdNum);

    const linkedProviderIds = (junctionRows || []).map((r: any) => r.service_provider_id).filter(Boolean);

    if (linkedProviderIds.length > 0) {
      query = query.or(`service_category_id.eq.${catIdNum},service_provider_id.in.(${linkedProviderIds.join(',')})`);
    } else {
      query = query.eq('service_category_id', catIdNum);
    }
  }

  if (!includeDeleted) {
    query = query.or('is_deleted.eq.false,is_deleted.is.null');
  }

  if (activeOnly) {
    query = query.or('is_active.eq.true,is_active.is.null');
  }

  if (search) {
    const s = search.trim().toLowerCase();
    // 1. Fetch matching breed service_provider_ids
    const { data: breedRows } = await supabaseAdmin
      .from('service_provider_breeds')
      .select('service_provider_id, breeds!inner(name)')
      .ilike('breeds.name', `%${s}%`);
    const breedProviderIds = (breedRows || []).map((r: any) => r.service_provider_id).filter(Boolean);

    // 2. Fetch matching category service_provider_ids
    const { data: catRows } = await supabaseAdmin
      .from('service_provider_categories')
      .select('service_provider_id, service_categories!inner(name)')
      .ilike('service_categories.name', `%${s}%`);
    const catProviderIds = (catRows || []).map((r: any) => r.service_provider_id).filter(Boolean);

    const extraIds = Array.from(new Set([...breedProviderIds, ...catProviderIds]));

    if (extraIds.length > 0) {
      query = query.or(`name.ilike.%${s}%,description.ilike.%${s}%,bio.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,service_provider_id.in.(${extraIds.join(',')})`);
    } else {
      query = query.or(`name.ilike.%${s}%,description.ilike.%${s}%,bio.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve user location from query, user_id, or Bearer auth token
  const userLocation = await resolveUserLocation(request);

  const result = applyLocationFilterAndSort(data || [], userLocation, {
    getLat: (provider: any) => {
      const rawLat = provider.locations?.latitude ?? provider.pet_friendly_places?.[0]?.latitude;
      return rawLat !== null && rawLat !== undefined && !isNaN(Number(rawLat)) ? Number(rawLat) : null;
    },
    getLng: (provider: any) => {
      const rawLng = provider.locations?.longitude ?? provider.pet_friendly_places?.[0]?.longitude;
      return rawLng !== null && rawLng !== undefined && !isNaN(Number(rawLng)) ? Number(rawLng) : null;
    },
  });

  return NextResponse.json({
    providers: result.items,
    user_location: result.user_location,
    total: result.total,
  });
}

function parseCategoryIds(rawCategoryIds: any, fallbackCategoryId?: any): number[] {
  let ids: number[] = [];
  if (Array.isArray(rawCategoryIds)) {
    ids = rawCategoryIds.map(Number).filter(n => !isNaN(n) && n > 0);
  } else if (typeof rawCategoryIds === 'string' && rawCategoryIds.trim()) {
    try {
      const parsed = JSON.parse(rawCategoryIds);
      if (Array.isArray(parsed)) {
        ids = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
      }
    } catch {
      ids = rawCategoryIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
    }
  }
  if (ids.length === 0 && fallbackCategoryId) {
    const num = Number(fallbackCategoryId);
    if (!isNaN(num) && num > 0) ids.push(num);
  }
  return Array.from(new Set(ids));
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const contentType = request.headers.get('content-type') || '';
  let body: Record<string, unknown> = {};
  let uploadedImageUrls: string[] = [];

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const formEntries = Array.from(formData.entries());

    for (const [key, value] of formEntries) {
      if (value instanceof File && value.size > 0) {
        if (value.size > 50 * 1024 * 1024) {
          return NextResponse.json({ error: `${value.name} exceeds the 50MB limit` }, { status: 400 });
        }
        if (!value.type.startsWith('image/')) {
          return NextResponse.json({ error: `${value.name} is not an image` }, { status: 400 });
        }
        const result = await uploadAnimalImage(value, 'service-providers');
        uploadedImageUrls.push(result.url);
      } else if (typeof value === 'string') {
        body[key] = value;
      }
    }

    if (uploadedImageUrls.length > 0) {
      body.image_url = uploadedImageUrls[0];
      body.images = uploadedImageUrls;
    }

    if (body.service_category_id) body.service_category_id = Number(body.service_category_id);
    if (body.rating) body.rating = Number(body.rating);
    if (body.total_reviews) body.total_reviews = Number(body.total_reviews);
    if (body.is_verified !== undefined) body.is_verified = body.is_verified === 'true' || body.is_verified === true;
    if (body.is_active !== undefined) body.is_active = body.is_active === 'true' || body.is_active === true;
    if (body.featured !== undefined) body.featured = body.featured === 'true' || body.featured === true;
    if (body.operating_hours && typeof body.operating_hours === 'string') {
      try { body.operating_hours = JSON.parse(body.operating_hours as string); } catch { /* ignore */ }
    }
  } else {
    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
    }
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ error: 'Request body is empty. Send a valid JSON object.' }, { status: 400 });
    }
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error('POST /api/v1/service-providers - JSON parse failed. Content-Type:', contentType, 'Body preview:', rawBody.substring(0, 200));
      const hint = rawBody.includes('=') && rawBody.includes('&')
        ? ' Body looks like form-data. In Postman, use Body > raw > JSON, not form-data.'
        : '';
      return NextResponse.json({ error: 'Invalid JSON in request body.' + hint }, { status: 400 });
    }
  }

  const { name, description, service_category_id, phone, emergency_number, number_2, email, website, image_url, bio, is_verified, is_active, featured, rating, total_reviews, operating_hours, show_operating_hours, images, services, breed_ids } = body;

  const categoryIds = parseCategoryIds(body.category_ids, service_category_id);
  const primaryCategoryId = categoryIds[0] || (service_category_id ? Number(service_category_id) : undefined);

  if (!name || !primaryCategoryId) {
    return NextResponse.json({ error: 'Provider name and service category are required' }, { status: 400 });
  }

  const finalPhone = (phone as string | undefined)?.trim() || null;
  const finalEmergency = (emergency_number as string | undefined)?.trim() || null;
  const imageList: string[] = Array.isArray(images) ? images : [];
  const primaryImage = imageList.length > 0 ? imageList[0] : (image_url || null);

  const { data: provider, error } = await supabaseAdmin
    .from('service_providers')
    .insert([{
      name,
      description: description || null,
      service_category_id: primaryCategoryId,
      phone: finalPhone,
      emergency_number: finalEmergency,
      number_2: number_2 || null,
      email: email || null,
      website: website || null,
      image_url: primaryImage,
      images: imageList,
      bio: bio || null,
      is_verified: is_verified ?? false,
      is_active: is_active ?? true,
      featured: featured ?? false,
      rating: rating ?? 0,
      total_reviews: total_reviews ?? 0,
      show_operating_hours: show_operating_hours ?? true,
      operating_hours: operating_hours || null,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (imageList.length > 0) {
    const imageRows = imageList.map((url: string, idx: number) => ({
      service_provider_id: provider.service_provider_id,
      image_url: url,
      order: idx,
    }));

    const { error: imgError } = await supabaseAdmin
      .from('service_provider_images')
      .insert(imageRows);

    if (imgError) {
      console.error('Failed to save images:', imgError.message);
    }
  }

  // Sync services if provided
  if (Array.isArray(services) && services.length > 0) {
    const validServices = services
      .filter((s: any) => s && s.name && s.name.trim())
      .map((s: any) => ({
        service_provider_id: provider.service_provider_id,
        name: s.name.trim(),
        description: s.description || null,
        price: s.price !== undefined && s.price !== null && s.price !== '' ? Number(s.price) : null,
        duration_minutes: s.duration_minutes ? Number(s.duration_minutes) : null,
        is_active: s.is_active ?? true,
      }));

    if (validServices.length > 0) {
      const { error: srvError } = await supabaseAdmin.from('services').insert(validServices);
      if (srvError) console.error('Failed to save services:', srvError.message);
    }
  }

  // Sync breeds if provided
  if (Array.isArray(breed_ids) && breed_ids.length > 0) {
    const breedRows = breed_ids.map((bId: number) => ({
      service_provider_id: provider.service_provider_id,
      breed_id: Number(bId),
    }));
    const { error: brdError } = await supabaseAdmin.from('service_provider_breeds').insert(breedRows);
    if (brdError) console.error('Failed to save breeds:', brdError.message);
  }

  // Sync service_provider_categories junction table
  if (categoryIds.length > 0) {
    const categoryRows = categoryIds.map((catId: number) => ({
      service_provider_id: provider.service_provider_id,
      service_category_id: catId,
    }));
    await supabaseAdmin.from('service_provider_categories').insert(categoryRows);
  }

  // Sync pet friendly place if requested
  const petFriendlyInfo = {
    is_pet_friendly_place: body.is_pet_friendly_place as boolean | undefined,
    pet_friendly_name: body.pet_friendly_name as string | null | undefined,
    pet_friendly_group_id: body.pet_friendly_group_id as number | null | undefined,
    amenities: body.amenities as string[] | null | undefined,
  };
  const locationPayload = {
    address: body.address as string | null | undefined,
    latitude: body.latitude as string | number | null | undefined,
    longitude: body.longitude as string | number | null | undefined,
  };

  if (petFriendlyInfo.is_pet_friendly_place) {
    syncServiceProviderToPetFriendlyPlace(
      provider.service_provider_id,
      { ...provider, ...locationPayload },
      { ...petFriendlyInfo, is_pet_friendly_place: true },
      supabaseAdmin
    );
  }

  return NextResponse.json({ provider });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) {
    console.error('PATCH /api/v1/service-providers - Auth FAILED:', JSON.stringify(auth));
    return auth;
  }

  const providerId = request.nextUrl.searchParams.get('service_provider_id');
  console.log(`PATCH /api/v1/service-providers - providerId=${providerId}, user=${(auth as any).user?.email}`);
  if (!providerId) {
    return NextResponse.json({ error: 'service_provider_id is required' }, { status: 400 });
  }


  let updates: Record<string, unknown>;
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }
  if (!rawBody || !rawBody.trim()) {
    return NextResponse.json({ error: 'Request body is empty. Send a valid JSON object.' }, { status: 400 });
  }
  try {
    updates = JSON.parse(rawBody);
  } catch (e) {
    console.error('PATCH /api/v1/service-providers - JSON parse failed. Content-Type:', request.headers.get('content-type'), 'Body preview:', rawBody.substring(0, 200));
    const hint = rawBody.includes('=') && rawBody.includes('&')
      ? ' Body looks like form-data. In Postman, use Body > raw > JSON, not form-data.'
      : '';
    return NextResponse.json({
      error: 'Invalid JSON in request body.' + hint
    }, { status: 400 });
  }

  // Sync service_provider_categories junction table if category updates are provided
  if (updates.category_ids !== undefined || updates.service_category_id !== undefined) {
    const catIds = parseCategoryIds(updates.category_ids, updates.service_category_id);

    if (catIds.length > 0) {
      updates.service_category_id = catIds[0];
      await supabaseAdmin.from('service_provider_categories').delete().eq('service_provider_id', providerId);
      const categoryRows = catIds.map((catId: number) => ({
        service_provider_id: Number(providerId),
        service_category_id: catId,
      }));
      await supabaseAdmin.from('service_provider_categories').insert(categoryRows);
    }
  }

  if (updates.phone !== undefined) {
    updates.phone = (updates.phone as string | undefined)?.trim() || null;
  }
  if (updates.emergency_number !== undefined) {
    updates.emergency_number = (updates.emergency_number as string | undefined)?.trim() || null;
  }

  // Extract petFriendlyInfo and location fields from the payload (not DB columns)
  const petFriendlyInfo = {
    is_pet_friendly_place: updates.is_pet_friendly_place as boolean | undefined,
    pet_friendly_name: updates.pet_friendly_name as string | null | undefined,
    pet_friendly_group_id: updates.pet_friendly_group_id as number | null | undefined,
    amenities: updates.amenities as string[] | null | undefined,
  };
  const locationPayload = {
    address: updates.address as string | null | undefined,
    latitude: updates.latitude as string | number | null | undefined,
    longitude: updates.longitude as string | number | null | undefined,
  };

  // Strip non-column/relation fields before sending to Supabase
  const { is_pet_friendly_place, pet_friendly_name, pet_friendly_group_id, amenities,
    address, latitude, longitude, show_publicly, category_ids, images, services, breed_ids, ...providerUpdates } = updates as any;

  // Sync images if provided
  if (images !== undefined && Array.isArray(images)) {
    // Fetch old images to clean up removed image files from storage
    const { data: existingImgRows } = await supabaseAdmin
      .from('service_provider_images')
      .select('image_url')
      .eq('service_provider_id', providerId);

    // Delete old images from service_provider_images
    await supabaseAdmin
      .from('service_provider_images')
      .delete()
      .eq('service_provider_id', providerId);

    // Insert updated images
    if (images.length > 0) {
      const imageRows = images.map((url: string, idx: number) => ({
        service_provider_id: Number(providerId),
        image_url: url,
        order: idx,
      }));
      await supabaseAdmin
        .from('service_provider_images')
        .insert(imageRows);
    }

    // Keep images JSONB column and image_url column in sync
    providerUpdates.images = images;
    providerUpdates.image_url = images.length > 0 ? images[0] : null;

    // Clean up removed image files from storage bucket
    if (existingImgRows && existingImgRows.length > 0) {
      const remainingUrls = new Set(images);
      for (const oldImg of existingImgRows) {
        if (oldImg.image_url && !remainingUrls.has(oldImg.image_url)) {
          try {
            await deleteAnimalImageByUrl(oldImg.image_url);
          } catch (e) {
            console.warn('Storage cleanup warning:', e);
          }
        }
      }
    }
  }

  // Sync services if provided
  if (services !== undefined && Array.isArray(services)) {
    await supabaseAdmin
      .from('services')
      .delete()
      .eq('service_provider_id', providerId);

    const validServices = services
      .filter((s: any) => s && s.name && s.name.trim())
      .map((s: any) => ({
        service_provider_id: Number(providerId),
        name: s.name.trim(),
        description: s.description || null,
        price: s.price !== undefined && s.price !== null && s.price !== '' ? Number(s.price) : null,
        duration_minutes: s.duration_minutes ? Number(s.duration_minutes) : null,
        is_active: s.is_active ?? true,
      }));

    if (validServices.length > 0) {
      await supabaseAdmin.from('services').insert(validServices);
    }
  }

  // Sync breeds if provided
  if (breed_ids !== undefined && Array.isArray(breed_ids)) {
    await supabaseAdmin
      .from('service_provider_breeds')
      .delete()
      .eq('service_provider_id', providerId);

    if (breed_ids.length > 0) {
      const breedRows = breed_ids.map((bId: number) => ({
        service_provider_id: Number(providerId),
        breed_id: Number(bId),
      }));
      await supabaseAdmin.from('service_provider_breeds').insert(breedRows);
    }
  }

  // Sync operating hours logic
  if (updates.show_operating_hours !== undefined) {
    providerUpdates.show_operating_hours = Boolean(updates.show_operating_hours);
    if (!providerUpdates.show_operating_hours) {
      providerUpdates.operating_hours = null;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('service_providers')
    .update(providerUpdates)
    .eq('service_provider_id', providerId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data) {
    // Use full petFriendlyInfo from the request (not hardcoded true)
    syncServiceProviderToPetFriendlyPlace(
      data.service_provider_id,
      { ...data, ...locationPayload },
      { ...petFriendlyInfo, is_pet_friendly_place: petFriendlyInfo.is_pet_friendly_place ?? true },
      supabaseAdmin
    );
  }

  return NextResponse.json({ provider: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const providerId = request.nextUrl.searchParams.get('service_provider_id');
  if (!providerId) {
    return NextResponse.json({ error: 'service_provider_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('service_providers').update({ is_deleted: true }).eq('service_provider_id', providerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
