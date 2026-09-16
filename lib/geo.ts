import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getTokenFromRequest } from '@/lib/server-auth';

export interface UserLocationContext {
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
  isAllRadius?: boolean;
  address: string | null;
  source: 'query' | 'body' | 'profile' | 'geocoded' | null;
  userId?: number | null;
}

/**
 * Calculates distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined) return null;
  if (lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) return null;

  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;
  if (nLat1 === 0 && nLon1 === 0) return null;
  if (nLat2 === 0 && nLon2 === 0) return null;

  const R = 6371; // Earth radius in km
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Formats distance into a human-readable string
 */
export function formatDistance(distanceKm: number | null | undefined): string {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) return 'Distance unavailable';
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Geocodes an address string using Google Geocoding API
 */
export async function geocodeAddress(
  address: string
): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!address || !address.trim()) {
    return { latitude: null, longitude: null };
  }

  const apiKey = process.env.Google_API || process.env.NEXT_PUBLIC_GOOGLE_API;
  if (!apiKey) {
    console.warn('Google Maps API key is missing for geocoding');
    return { latitude: null, longitude: null };
  }

  try {
    const encoded = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { latitude: lat, longitude: lng };
    }
    return { latitude: null, longitude: null };
  } catch (err) {
    console.error('Geocoding request failed:', err);
    return { latitude: null, longitude: null };
  }
}

/**
 * Resolves user coordinates and radius from request query, body, user ID, or Bearer auth token
 */
export async function resolveUserLocation(
  request: NextRequest,
  bodyData?: any
): Promise<UserLocationContext> {
  const searchParams = request.nextUrl.searchParams;

  // 1. Check explicit coordinates in query or body
  const rawLat = searchParams.get('latitude') ?? searchParams.get('lat') ?? bodyData?.latitude ?? bodyData?.lat;
  const rawLng = searchParams.get('longitude') ?? searchParams.get('lng') ?? bodyData?.longitude ?? bodyData?.lng;

  let latitude: number | null = rawLat !== null && rawLat !== undefined && rawLat !== '' ? parseFloat(String(rawLat)) : null;
  let longitude: number | null = rawLng !== null && rawLng !== undefined && rawLng !== '' ? parseFloat(String(rawLng)) : null;

  if (isNaN(latitude as number)) latitude = null;
  if (isNaN(longitude as number)) longitude = null;

  // Check radius parameter (supports: 10, "20", "50km", "all", "0", "false")
  const rawRadius =
    searchParams.get('radius') ??
    searchParams.get('radius_km') ??
    searchParams.get('distance') ??
    bodyData?.radius ??
    bodyData?.radius_km ??
    bodyData?.preferred_radius;

  let radiusKm: number | null = null;
  let isAllRadius = false;

  if (rawRadius !== null && rawRadius !== undefined && rawRadius !== '') {
    const strRadius = String(rawRadius).toLowerCase().trim();
    if (['all', '0', 'none', 'false', 'unlimited', 'any'].includes(strRadius)) {
      radiusKm = null;
      isAllRadius = true; // explicitly requested to disable radius constraint
    } else {
      const parsedRadius = parseFloat(strRadius.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedRadius) && parsedRadius > 0) {
        radiusKm = parsedRadius;
      }
    }
  }

  let address: string | null =
    searchParams.get('location') ??
    searchParams.get('address') ??
    bodyData?.location ??
    bodyData?.address ??
    null;

  let source: UserLocationContext['source'] = latitude !== null && longitude !== null ? (rawLat ? 'query' : 'body') : null;
  let userId: number | null = null;

  // 2. If coordinates not provided, check user_id or Bearer auth token / cookies to pull from profile
  const rawUserId = searchParams.get('user_id') ?? bodyData?.user_id;
  if (rawUserId) {
    userId = Number(rawUserId);
  } else {
    const token = await getTokenFromRequest(request);
    if (token) {
      try {
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        if (authData?.user?.id) {
          let { data: userRow } = await supabaseAdmin
            .from('users')
            .select('user_id, latitude, longitude, static_location, preferred_radius')
            .eq('auth_user_id', authData.user.id)
            .maybeSingle();

          if (!userRow && authData.user.email) {
            const fallback = await supabaseAdmin
              .from('users')
              .select('user_id, latitude, longitude, static_location, preferred_radius')
              .eq('email', authData.user.email)
              .maybeSingle();
            userRow = fallback.data;
          }

          if (userRow?.user_id) {
            userId = userRow.user_id;
            if (latitude === null || longitude === null) {
              if (userRow.latitude && userRow.longitude) {
                latitude = Number(userRow.latitude);
                longitude = Number(userRow.longitude);
                source = 'profile';
              }
            }

            if (!address && userRow.static_location) {
              address = userRow.static_location;
            }

            // Inherit preferred_radius if not explicitly passed in request
            if (
              radiusKm === null &&
              !isAllRadius &&
              (rawRadius === null || rawRadius === undefined || rawRadius === '')
            ) {
              if (
                userRow.preferred_radius === null ||
                userRow.preferred_radius === undefined ||
                Number(userRow.preferred_radius) === 0 ||
                String(userRow.preferred_radius).toLowerCase().trim() === 'all'
              ) {
                radiusKm = null;
                isAllRadius = true;
              } else {
                const prefRadius = parseFloat(String(userRow.preferred_radius));
                if (!isNaN(prefRadius) && prefRadius > 0) {
                  radiusKm = prefRadius;
                }
              }
            }
          }
        }
      } catch {
        // Continue if token resolution fails
      }
    }
  }

  // Fetch user profile location & preferred radius if userId resolved from param
  if (userId && (latitude === null || longitude === null || (radiusKm === null && !isAllRadius))) {
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('user_id, latitude, longitude, static_location, preferred_radius')
        .eq('user_id', userId)
        .maybeSingle();

      if (userProfile) {
        if (latitude === null || longitude === null) {
          if (userProfile.latitude && userProfile.longitude) {
            latitude = Number(userProfile.latitude);
            longitude = Number(userProfile.longitude);
            source = 'profile';
          }
        }

        if (!address && userProfile.static_location) {
          address = userProfile.static_location;
        }

        // Inherit preferred_radius if not explicitly passed
        if (
          radiusKm === null &&
          !isAllRadius &&
          (rawRadius === null || rawRadius === undefined || rawRadius === '')
        ) {
          if (
            userProfile.preferred_radius === null ||
            userProfile.preferred_radius === undefined ||
            Number(userProfile.preferred_radius) === 0 ||
            String(userProfile.preferred_radius).toLowerCase().trim() === 'all'
          ) {
            radiusKm = null;
            isAllRadius = true;
          } else {
            const prefRadius = parseFloat(String(userProfile.preferred_radius));
            if (!isNaN(prefRadius) && prefRadius > 0) {
              radiusKm = prefRadius;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user profile for location:', err);
    }
  }

  // 3. If address provided but coordinates still missing, geocode the address
  if ((latitude === null || longitude === null) && address && address.trim()) {
    const geocoded = await geocodeAddress(address);
    if (geocoded.latitude !== null && geocoded.longitude !== null) {
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      source = 'geocoded';
    }
  }

  return {
    latitude,
    longitude,
    radiusKm,
    isAllRadius,
    address,
    source,
    userId,
  };
}

/**
 * Enriches a list of items with distance and applies radius filter & sorting
 */
export function applyLocationFilterAndSort<T extends Record<string, any>>(
  items: T[],
  userLocation: UserLocationContext,
  options: {
    getLat: (item: T) => number | null;
    getLng: (item: T) => number | null;
    filterByRadius?: boolean;
  }
): {
  items: (T & {
    distance_km: number | null;
    formatted_distance: string;
    is_within_radius: boolean;
  })[];
  user_location: {
    latitude: number | null;
    longitude: number | null;
    radius_km: number | string | null;
    is_all_radius?: boolean;
    address: string | null;
    source: string | null;
  };
  total: number;
} {
  const { latitude: userLat, longitude: userLng, radiusKm, isAllRadius } = userLocation;
  const hasUserLocation = userLat !== null && userLng !== null;
  const isAll = Boolean(isAllRadius || radiusKm === null);

  const enriched = items.map((item) => {
    const itemLat = options.getLat(item);
    const itemLng = options.getLng(item);

    let distance_km: number | null = null;

    if (hasUserLocation && itemLat !== null && itemLng !== null && !(itemLat === 0 && itemLng === 0)) {
      distance_km = calculateDistanceKm(userLat!, userLng!, itemLat, itemLng);
    }

    const is_within_radius = isAll
      ? true
      : distance_km !== null && radiusKm !== null && distance_km <= radiusKm;

    return {
      ...item,
      distance_km,
      formatted_distance: formatDistance(distance_km),
      is_within_radius,
    };
  });

  // Filter by radius ONLY if user did not request "all", radiusKm is set, and filtering is enabled
  const shouldFilter = options.filterByRadius !== false && !isAll && radiusKm !== null && hasUserLocation;
  const filtered = shouldFilter
    ? enriched.filter((item) => item.distance_km !== null && item.distance_km <= radiusKm)
    : enriched;

  // Sort by distance if user location is available: closest first
  if (hasUserLocation) {
    filtered.sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });
  }

  return {
    items: filtered,
    user_location: {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      radius_km: isAll ? 'all' : userLocation.radiusKm,
      is_all_radius: isAll,
      address: userLocation.address,
      source: userLocation.source,
    },
    total: filtered.length,
  };
}
