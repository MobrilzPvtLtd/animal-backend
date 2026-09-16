import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { resolveUserLocation, applyLocationFilterAndSort } from '@/lib/geo';
import { normalizePlaceImages } from '@/lib/image-normalizer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/locations/nearby
 *
 * Returns all Pet Friendly Places and Service Providers within the user's
 * selected circle radius (e.g. 10 km, 20 km, 50 km).
 *
 * If latitude & longitude or radius are not explicitly passed as query parameters,
 * it automatically uses the user's profile coordinates and preferred_radius
 * from the Bearer token or session cookies.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type')?.toLowerCase(); // 'all' | 'places' | 'providers'
    const search = searchParams.get('search')?.trim().toLowerCase();

    // 1. Resolve user location & radius from query or profile
    const userLocation = await resolveUserLocation(request);

    if (userLocation.latitude === null || userLocation.longitude === null) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Location coordinates could not be determined. Please provide latitude and longitude query parameters (?latitude=...&longitude=...) or update your location in your profile.',
          user_location: userLocation,
        },
        { status: 400 }
      );
    }

    const isAll = Boolean(userLocation.isAllRadius || userLocation.radiusKm === null);
    const radiusKm = isAll ? null : userLocation.radiusKm;

    // 2. Fetch Pet-Friendly Places
    const shouldFetchPlaces = !type || type === 'all' || type === 'places';
    const fetchPlaces = async () => {
      if (!shouldFetchPlaces) return { data: [] };
      let placesQuery = supabaseAdmin
        .from('pet_friendly_places')
        .select('*, place_groups(group:groups(*)), service_provider:service_providers(*, locations(*))')
        .eq('is_deleted', false);

      if (search) {
        placesQuery = placesQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`);
      }
      return await placesQuery;
    };

    // 3. Fetch Service Providers
    const shouldFetchProviders = !type || type === 'all' || type === 'providers';
    const fetchProviders = async () => {
      if (!shouldFetchProviders) return { data: [] };
      let providersQuery = supabaseAdmin
        .from('service_providers')
        .select(
          '*, locations(*), pet_friendly_places(latitude, longitude, address), service_categories!service_providers_service_category_id_fkey(*), service_provider_categories(service_category:service_categories(*)), service_provider_images(*)'
        )
        .or('is_deleted.eq.false,is_deleted.is.null')
        .or('is_active.eq.true,is_active.is.null');

      if (search) {
        providersQuery = providersQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%,bio.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      return await providersQuery;
    };

    const [placesRes, providersRes] = await Promise.all([fetchPlaces(), fetchProviders()]);

    const rawPlaces = (placesRes.data || []).map(normalizePlaceImages);
    const rawProviders = providersRes.data || [];

    // 4. Apply distance calculation, radius circle filtering (if not 'all') and closest-first sorting
    const filteredPlaces = applyLocationFilterAndSort(rawPlaces, { ...userLocation, radiusKm, isAllRadius: isAll }, {
      getLat: (place: any) => {
        const lat = place.latitude ?? place.service_provider?.locations?.latitude;
        return lat !== null && lat !== undefined && !isNaN(Number(lat)) ? Number(lat) : null;
      },
      getLng: (place: any) => {
        const lng = place.longitude ?? place.service_provider?.locations?.longitude;
        return lng !== null && lng !== undefined && !isNaN(Number(lng)) ? Number(lng) : null;
      },
      filterByRadius: !isAll,
    });

    const filteredProviders = applyLocationFilterAndSort(rawProviders, { ...userLocation, radiusKm, isAllRadius: isAll }, {
      getLat: (provider: any) => {
        const rawLat = provider.locations?.latitude ?? provider.pet_friendly_places?.[0]?.latitude ?? provider.latitude;
        return rawLat !== null && rawLat !== undefined && !isNaN(Number(rawLat)) ? Number(rawLat) : null;
      },
      getLng: (provider: any) => {
        const rawLng = provider.locations?.longitude ?? provider.pet_friendly_places?.[0]?.longitude ?? provider.longitude;
        return rawLng !== null && rawLng !== undefined && !isNaN(Number(rawLng)) ? Number(rawLng) : null;
      },
      filterByRadius: !isAll,
    });

    return NextResponse.json({
      success: true,
      user_location: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radius_km: isAll ? 'all' : radiusKm,
        is_all_radius: isAll,
        address: userLocation.address,
        source: userLocation.source,
      },
      radius_km: isAll ? 'all' : radiusKm,
      is_all_radius: isAll,
      counts: {
        places: filteredPlaces.total,
        service_providers: filteredProviders.total,
        total: filteredPlaces.total + filteredProviders.total,
      },
      places: filteredPlaces.items,
      service_providers: filteredProviders.items,
    });
  } catch (err: any) {
    console.error('Error in /api/v1/locations/nearby:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch nearby places and service providers' },
      { status: 500 }
    );
  }
}
