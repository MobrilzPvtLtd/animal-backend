import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest, requireRoles } from '@/lib/server-auth';
import { getInappropriateWords } from '@/lib/word-filter';

async function enrichReviewsWithUserData(reviews: any[]) {
  if (!reviews || reviews.length === 0) return [];

  const userIds = Array.from(new Set(reviews.map((r: any) => r.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return reviews.map((r: any) => ({
      ...r,
      reviewer_name: r.reviewer_name && r.reviewer_name !== 'Anonymous Pet Owner' && r.reviewer_name !== 'Pet Owner' ? r.reviewer_name : 'Pet Owner',
    }));
  }

  const numericUserIds = userIds.map((id) => Number(id)).filter((n) => !isNaN(n));

  let userData: any[] = [];
  if (numericUserIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('user_id, auth_user_id, name, surname, user_name, full_name, email, avatar_url, profile_image_url')
      .in('user_id', numericUserIds);

    if (!error && data) {
      userData = data;
    }
  }

  const userMap = new Map<string, any>();
  userData.forEach((u: any) => {
    if (u.user_id !== undefined && u.user_id !== null) {
      userMap.set(String(u.user_id), u);
    }
  });

  return reviews.map((r: any) => {
    const u = r.user_id ? userMap.get(String(r.user_id)) : null;

    const computedName =
      (u?.name ? `${u.name}${u.surname ? ' ' + u.surname : ''}` : null) ||
      u?.user_name ||
      u?.full_name ||
      (u?.email ? u.email.split('@')[0] : null);

    const name =
      computedName ||
      (r.reviewer_name && r.reviewer_name !== 'Anonymous Pet Owner' && r.reviewer_name !== 'Pet Owner'
        ? r.reviewer_name
        : 'Pet Owner');

    const image = u?.profile_image_url || u?.avatar_url || r.reviewer_image || null;

    return {
      ...r,
      reviewer_name: name,
      reviewer_image: image,
    };
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('place_id') || searchParams.get('placeId') || searchParams.get('pet_friendly_place_id');
  const serviceProviderId = searchParams.get('service_provider_id') || searchParams.get('serviceProviderId') || searchParams.get('provider_id');
  const listingId = searchParams.get('listing_id') || searchParams.get('listingId');

  const extractNumericId = (str: string | null): number | null => {
    if (!str) return null;
    const match = str.match(/\d+/);
    return match ? Number(match[0]) : null;
  };

  let targetPlaceIds: number[] = [];

  // 1. Resolve service_provider_id to pet_friendly_place_id
  if (serviceProviderId && !isNaN(Number(serviceProviderId))) {
    const spId = Number(serviceProviderId);
    const { data: spPlace } = await supabaseAdmin
      .from('pet_friendly_places')
      .select('pet_friendly_place_id')
      .eq('service_provider_id', spId)
      .maybeSingle();

    if (spPlace?.pet_friendly_place_id) {
      targetPlaceIds.push(spPlace.pet_friendly_place_id);
    }
  }

  // 2. Resolve place_id
  if (placeId && !isNaN(Number(placeId))) {
    targetPlaceIds.push(Number(placeId));
  } else if (listingId) {
    const parsedId = extractNumericId(listingId);
    if (parsedId) targetPlaceIds.push(parsedId);
  }

  // Remove duplicate IDs
  targetPlaceIds = Array.from(new Set(targetPlaceIds));

  // If specific place IDs were resolved
  if (targetPlaceIds.length > 0) {
    let query = supabaseAdmin
      .from('reviews')
      .select('*')
      .in('place_id', targetPlaceIds)
      .order('created_at', { ascending: false });

    const { data: placeData, error: placeError } = await query;

    if (!placeError && placeData && placeData.length > 0) {
      const enriched = await enrichReviewsWithUserData(placeData);
      return NextResponse.json({ reviews: enriched });
    }
  }

  // Fallback query by listing_id if provided
  if (listingId) {
    const { data: listingData, error: listingError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (!listingError && listingData && listingData.length > 0) {
      const enriched = await enrichReviewsWithUserData(listingData);
      return NextResponse.json({ reviews: enriched });
    }
  }

  // Fallback to all reviews if no specific filters provided or no matching filtered reviews
  const { data: allData, error: allError } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('GET reviews error:', allError.message);
    return NextResponse.json({ reviews: [] });
  }

  const enriched = await enrichReviewsWithUserData(allData || []);
  return NextResponse.json({ reviews: enriched });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user || !user.internalUserId) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to submit a review.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const {
      place_id,
      placeId,
      pet_friendly_place_id,
      petFriendlyPlaceId,
      service_provider_id,
      serviceProviderId,
      provider_id,
      providerId,
      listing_id,
      listingId,
      rating,
      comment,
      reviewer_name,
      reviewer_image,
      reviewerName,
      reviewerImage,
    } = body;

    const rawPlaceId = place_id || placeId || pet_friendly_place_id || petFriendlyPlaceId;
    const rawServiceProviderId = service_provider_id || serviceProviderId || provider_id || providerId;
    const targetListingId = listing_id || listingId || (rawPlaceId ? String(rawPlaceId) : (rawServiceProviderId ? String(rawServiceProviderId) : 'default'));

    const targetRating = Number(rating);
    const cleanComment = typeof comment === 'string' ? comment.trim() : '';

    if (!cleanComment) {
      return NextResponse.json({ error: 'Review comment is required' }, { status: 400 });
    }

    if (isNaN(targetRating) || targetRating < 1 || targetRating > 5) {
      return NextResponse.json({ error: 'Rating must be a number between 1 and 5' }, { status: 400 });
    }

    // Run profanity & inappropriate word filtering
    const flaggedWords = getInappropriateWords(cleanComment);
    if (flaggedWords.length > 0) {
      return NextResponse.json(
        {
          error: 'Review contains inappropriate language',
          message: 'Your review contains inappropriate or rude language. Please remove it before posting.',
          flaggedWords,
        },
        { status: 400 }
      );
    }

    // Resolve target place_id from either place_id OR service_provider_id
    let extractedPlaceId: number | null = rawPlaceId ? Number(rawPlaceId) : null;

    // If service_provider_id is passed, look up its synced pet_friendly_place_id
    if ((!extractedPlaceId || isNaN(extractedPlaceId)) && rawServiceProviderId && !isNaN(Number(rawServiceProviderId))) {
      const spId = Number(rawServiceProviderId);
      const { data: spPlace } = await supabaseAdmin
        .from('pet_friendly_places')
        .select('pet_friendly_place_id')
        .eq('service_provider_id', spId)
        .maybeSingle();

      if (spPlace?.pet_friendly_place_id) {
        extractedPlaceId = spPlace.pet_friendly_place_id;
      }
    }

    // If still null, try extracting ID from targetListingId
    if ((!extractedPlaceId || isNaN(extractedPlaceId)) && targetListingId) {
      const matchNum = targetListingId.match(/\d+/);
      if (matchNum) {
        const parsedId = Number(matchNum[0]);
        const { data: placeCheck } = await supabaseAdmin
          .from('pet_friendly_places')
          .select('pet_friendly_place_id')
          .or(`pet_friendly_place_id.eq.${parsedId},service_provider_id.eq.${parsedId}`)
          .maybeSingle();

        if (placeCheck?.pet_friendly_place_id) {
          extractedPlaceId = placeCheck.pet_friendly_place_id;
        }
      }
    }

    if (!extractedPlaceId || isNaN(extractedPlaceId)) {
      return NextResponse.json(
        { error: 'Valid place_id or service_provider_id is required to submit a review.' },
        { status: 400 }
      );
    }

    // Validate that place_id exists in pet_friendly_places table
    const { data: placeExists } = await supabaseAdmin
      .from('pet_friendly_places')
      .select('pet_friendly_place_id')
      .eq('pet_friendly_place_id', extractedPlaceId)
      .maybeSingle();

    if (!placeExists) {
      return NextResponse.json(
        {
          error: `Invalid place/provider ID (${extractedPlaceId}): Target entity does not exist in pet_friendly_places table.`
        },
        { status: 400 }
      );
    }

    const rawUserId = user.internalUserId;
    const targetUserId = isNaN(Number(rawUserId)) ? rawUserId : Number(rawUserId);

    // Fetch user details from users table for logged in user
    let dbUser: any = null;
    const { data: uData } = await supabaseAdmin
      .from('users')
      .select('name, surname, user_name, full_name, email, avatar_url, profile_image_url')
      .or(`user_id.eq.${targetUserId || '0'},auth_user_id.eq.${user.id || '0'}`)
      .maybeSingle();
    dbUser = uData;

    const tokenName =
      (dbUser?.name ? `${dbUser.name}${dbUser.surname ? ' ' + dbUser.surname : ''}` : null) ||
      dbUser?.user_name ||
      dbUser?.full_name ||
      (user as any)?.user_metadata?.name ||
      (user as any)?.user_metadata?.full_name ||
      (user as any)?.user_metadata?.user_name;

    const tokenImage =
      dbUser?.profile_image_url ||
      dbUser?.avatar_url ||
      (user as any)?.user_metadata?.profile_image_url ||
      (user as any)?.user_metadata?.avatar_url;

    const name =
      reviewer_name && reviewer_name !== 'Anonymous Pet Owner' && reviewer_name !== 'Pet Owner'
        ? reviewer_name
        : reviewerName && reviewerName !== 'Anonymous Pet Owner' && reviewerName !== 'Pet Owner'
        ? reviewerName
        : tokenName || (user.email ? user.email.split('@')[0] : 'Pet Owner');

    const image = reviewer_image || reviewerImage || tokenImage || null;

    // 1. Primary insert payload
    const fullPayload: Record<string, any> = {
      user_id: targetUserId,
      place_id: extractedPlaceId,
      listing_id: targetListingId,
      rating: targetRating,
      comment: cleanComment,
      reviewer_name: name,
      reviewer_image: image,
      likes: 0,
      is_approved: true,
    };

    const { data: fullData, error: fullError } = await supabaseAdmin
      .from('reviews')
      .insert([fullPayload])
      .select()
      .single();

    if (!fullError && fullData) {
      return NextResponse.json(
        {
          success: true,
          message: 'Thank you! Your review has been published.',
          review: {
            ...fullData,
            reviewer_name: name,
            reviewer_image: image,
          },
          flaggedWords: [],
        },
        { status: 201 }
      );
    }

    // Handle foreign key error explicitly
    if (fullError?.code === '23503' || fullError?.message?.includes('foreign key constraint')) {
      return NextResponse.json(
        {
          error: `Invalid place_id (${extractedPlaceId}): Place with this ID does not exist in pet_friendly_places table.`
        },
        { status: 400 }
      );
    }

    // Fallback base insertion if listing_id or likes column is missing in DB schema cache
    console.warn('Full review insert failed, attempting base fallback insert:', fullError?.message);

    const basePayload: Record<string, any> = {
      user_id: targetUserId,
      place_id: extractedPlaceId,
      rating: targetRating,
      comment: cleanComment,
      is_approved: true,
    };

    const { data: baseData, error: baseError } = await supabaseAdmin
      .from('reviews')
      .insert([basePayload])
      .select()
      .single();

    if (baseError) {
      if (baseError.code === '23503' || baseError.message?.includes('foreign key constraint')) {
        return NextResponse.json(
          {
            error: `Invalid place_id (${extractedPlaceId}): Place with this ID does not exist in pet_friendly_places table.`
          },
          { status: 400 }
        );
      }

      // If unique constraint is hit, update the existing review
      const isBaseDuplicate =
        baseError.code === '23505' ||
        baseError.message?.includes('unique constraint') ||
        baseError.message?.includes('reviews_user_id_place_id_key');

      if (isBaseDuplicate && (targetUserId || extractedPlaceId)) {
        let updateBase = supabaseAdmin
          .from('reviews')
          .update({
            rating: targetRating,
            comment: cleanComment,
            updated_at: new Date().toISOString(),
          });

        if (targetUserId) {
          updateBase = updateBase.eq('user_id', targetUserId);
        }
        if (extractedPlaceId) {
          updateBase = updateBase.eq('place_id', extractedPlaceId);
        }

        const { data: updatedBaseData, error: updateBaseErr } = await updateBase.select().maybeSingle();
        if (!updateBaseErr && updatedBaseData) {
          return NextResponse.json(
            {
              success: true,
              message: 'Thank you! Your review has been updated.',
              review: {
                ...updatedBaseData,
                listing_id: targetListingId,
                reviewer_name: name,
                reviewer_image: image,
              },
              flaggedWords: [],
            },
            { status: 200 }
          );
        }
      }

      console.error('Base review insert also failed:', baseError.message);
      return NextResponse.json({ error: baseError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Your review has been published.',
        review: {
          ...baseData,
          listing_id: targetListingId,
          reviewer_name: name,
          reviewer_image: image,
          likes: 0,
        },
        flaggedWords: [],
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unhandled error in reviews POST:', error);
    return NextResponse.json({ error: error?.message || 'Failed to submit review' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Approver']);
  if ('status' in auth) return auth;

  const reviewId = request.nextUrl.searchParams.get('review_id');
  if (!reviewId) {
    return NextResponse.json({ error: 'review_id is required' }, { status: 400 });
  }

  const updates = await request.json();
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .update(updates)
    .eq('review_id', reviewId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const reviewId = request.nextUrl.searchParams.get('review_id');
  if (!reviewId) {
    return NextResponse.json({ error: 'review_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('reviews').delete().eq('review_id', reviewId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
