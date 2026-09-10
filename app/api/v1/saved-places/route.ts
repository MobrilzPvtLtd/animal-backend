import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';
import { normalizePlaceImages } from '@/lib/image-normalizer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/saved-places (and /api/v1/places/saved)
 * Returns all pet-friendly places saved/liked by the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = Number(user.internalUserId);
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = searchParams.get('limit') ? Math.max(1, parseInt(searchParams.get('limit') || '20')) : null;

    let query = supabaseAdmin
      .from('saved_places')
      .select(`
        user_id,
        place_id,
        created_at,
        place:pet_friendly_places!saved_places_place_id_fkey (
          pet_friendly_place_id,
          name,
          description,
          address,
          phone,
          email,
          website,
          place_type,
          price_range,
          is_verified,
          rating,
          views,
          image_url,
          images,
          operating_hours,
          amenities,
          pet_policy,
          latitude,
          longitude,
          show_publicly,
          is_approved,
          is_deleted,
          created_at,
          place_groups (
            group:groups (*)
          )
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (limit) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching saved places:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format places and exclude any deleted ones
    let formattedPlaces = (data || [])
      .filter((item: any) => item.place && item.place.is_deleted !== true)
      .map((item: any) => {
        const place = normalizePlaceImages(item.place);
        return {
          saved_at: item.created_at,
          is_saved: true,
          is_liked: true,
          ...place,
          place_id: place.pet_friendly_place_id,
        };
      });

    if (search) {
      const searchLower = search.toLowerCase();
      formattedPlaces = formattedPlaces.filter((p: any) =>
        p.name?.toLowerCase().includes(searchLower) ||
        p.address?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      count: formattedPlaces.length,
      total: count ?? formattedPlaces.length,
      page,
      places: formattedPlaces,
    });
  } catch (error: any) {
    console.error('Unexpected error fetching saved places:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch saved places' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/saved-places (and /api/v1/places/saved)
 * Saves/likes a place for the authenticated user.
 * Supports:
 * - { "place_id": 4 } -> saves/likes the place
 * - { "place_id": 4, "action": "unlike" | "remove" } -> unlikes/removes
 * - { "place_id": 4, "action": "toggle" } -> toggles save status
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = Number(user.internalUserId);
    const body = await request.json().catch(() => ({}));

    const rawPlaceId = body.place_id || body.pet_friendly_place_id || body.id;
    const action = String(body.action || 'like').toLowerCase();

    if (!rawPlaceId || isNaN(Number(rawPlaceId))) {
      return NextResponse.json(
        { error: 'Valid place_id is required in request body' },
        { status: 400 }
      );
    }

    const placeId = Number(rawPlaceId);

    // 1. Verify that the place exists in pet_friendly_places and is not deleted
    const { data: place, error: placeError } = await supabaseAdmin
      .from('pet_friendly_places')
      .select(`
        pet_friendly_place_id, 
        name, 
        image_url, 
        address, 
        rating, 
        price_range, 
        place_type,
        images,
        is_verified
      `)
      .eq('pet_friendly_place_id', placeId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (placeError) {
      console.error('Error verifying pet friendly place:', placeError);
      return NextResponse.json({ error: placeError.message }, { status: 500 });
    }

    if (!place) {
      return NextResponse.json(
        { error: `Pet friendly place with id ${placeId} not found` },
        { status: 404 }
      );
    }

    // 2. Check if already saved
    const { data: existing } = await supabaseAdmin
      .from('saved_places')
      .select('user_id, place_id, created_at')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle();

    // If action is unlike or remove
    if (action === 'unlike' || action === 'remove') {
      if (existing) {
        await supabaseAdmin
          .from('saved_places')
          .delete()
          .eq('user_id', userId)
          .eq('place_id', placeId);
      }
      return NextResponse.json({
        success: true,
        message: 'Place removed from saved places',
        is_saved: false,
        is_liked: false,
        place_id: placeId,
      });
    }

    // If action is toggle
    if (action === 'toggle') {
      if (existing) {
        await supabaseAdmin
          .from('saved_places')
          .delete()
          .eq('user_id', userId)
          .eq('place_id', placeId);

        return NextResponse.json({
          success: true,
          message: 'Place removed from saved places',
          is_saved: false,
          is_liked: false,
          place_id: placeId,
        });
      } else {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('saved_places')
          .insert([{ user_id: userId, place_id: placeId }])
          .select()
          .single();

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Place liked and saved successfully',
          is_saved: true,
          is_liked: true,
          place_id: placeId,
          saved_at: inserted.created_at,
          place: {
            ...place,
            place_id: place.pet_friendly_place_id,
          },
        }, { status: 201 });
      }
    }

    // Default action: like / save
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Place is already in saved places',
        is_saved: true,
        is_liked: true,
        place_id: placeId,
        saved_at: existing.created_at,
        place: {
          ...place,
          place_id: place.pet_friendly_place_id,
        },
      }, { status: 200 });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('saved_places')
      .insert([{ user_id: userId, place_id: placeId }])
      .select()
      .single();

    if (insertError) {
      console.error('Error saving place:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Place liked and saved successfully',
      is_saved: true,
      is_liked: true,
      place_id: placeId,
      saved_at: inserted.created_at,
      place: {
        ...place,
        place_id: place.pet_friendly_place_id,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Unexpected error saving place:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save place' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/saved-places (and /api/v1/places/saved)
 * Removes a place from the authenticated user's saved places.
 * Accepts place_id via query parameter ?place_id=... or JSON body { "place_id": ... }
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = Number(user.internalUserId);
    const searchParams = request.nextUrl.searchParams;
    let placeId = searchParams.get('place_id') || searchParams.get('id');

    if (!placeId) {
      const body = await request.json().catch(() => ({}));
      placeId = body.place_id || body.pet_friendly_place_id || body.id;
    }

    if (!placeId || isNaN(Number(placeId))) {
      return NextResponse.json(
        { error: 'Valid place_id is required via query param ?place_id=... or request body' },
        { status: 400 }
      );
    }

    const numPlaceId = Number(placeId);

    const { error: deleteError } = await supabaseAdmin
      .from('saved_places')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', numPlaceId);

    if (deleteError) {
      console.error('Error deleting saved place:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Place removed from saved places successfully',
      is_saved: false,
      is_liked: false,
      place_id: numPlaceId,
    });
  } catch (error: any) {
    console.error('Unexpected error removing saved place:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to remove saved place' },
      { status: 500 }
    );
  }
}
