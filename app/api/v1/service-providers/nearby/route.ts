import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { resolveUserLocation, applyLocationFilterAndSort } from '@/lib/geo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handleNearbyProviders(request: NextRequest, bodyData?: any) {
  const serviceCategoryId = request.nextUrl.searchParams.get('service_category_id') || bodyData?.service_category_id;
  const search = request.nextUrl.searchParams.get('search') || bodyData?.search;
  const activeOnly = (request.nextUrl.searchParams.get('active_only') || bodyData?.active_only) !== 'false';
  const includeDeleted = (request.nextUrl.searchParams.get('include_deleted') || bodyData?.include_deleted) === 'true';

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
    const { data: breedRows } = await supabaseAdmin
      .from('service_provider_breeds')
      .select('service_provider_id, breeds!inner(name)')
      .ilike('breeds.name', `%${s}%`);
    const breedProviderIds = (breedRows || []).map((r: any) => r.service_provider_id).filter(Boolean);

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

  const userLocation = await resolveUserLocation(request, bodyData);

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

export async function GET(request: NextRequest) {
  return handleNearbyProviders(request);
}

export async function POST(request: NextRequest) {
  let bodyData: any = {};
  try {
    bodyData = await request.json();
  } catch {
    // Body is optional
  }
  return handleNearbyProviders(request, bodyData);
}
