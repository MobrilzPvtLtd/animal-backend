import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { normalizePlaceImages } from '@/lib/image-normalizer';
import { resolveUserLocation, applyLocationFilterAndSort } from '@/lib/geo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handleNearbyPlaces(request: NextRequest, bodyData?: any) {
  const search = request.nextUrl.searchParams.get('search') || bodyData?.search;
  const includeDeleted = request.nextUrl.searchParams.get('include_deleted') || bodyData?.include_deleted;

  let query = supabaseAdmin
    .from('pet_friendly_places')
    .select(`*, place_groups(group:groups(*)), service_provider:service_providers(*, locations(*))`)
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

  const places = (data || []).map(normalizePlaceImages);
  const userLocation = await resolveUserLocation(request, bodyData);

  const result = applyLocationFilterAndSort(places, userLocation, {
    getLat: (place: any) => {
      const lat = place.latitude ?? place.service_provider?.locations?.latitude;
      return lat !== null && lat !== undefined && !isNaN(Number(lat)) ? Number(lat) : null;
    },
    getLng: (place: any) => {
      const lng = place.longitude ?? place.service_provider?.locations?.longitude;
      return lng !== null && lng !== undefined && !isNaN(Number(lng)) ? Number(lng) : null;
    },
  });

  return NextResponse.json({
    places: result.items,
    user_location: result.user_location,
    total: result.total,
  });
}

export async function GET(request: NextRequest) {
  return handleNearbyPlaces(request);
}

export async function POST(request: NextRequest) {
  let bodyData: any = {};
  try {
    bodyData = await request.json();
  } catch {
    // Body is optional
  }
  return handleNearbyPlaces(request, bodyData);
}
