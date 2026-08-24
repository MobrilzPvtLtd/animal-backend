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
  const placeId = searchParams.get('place_id') || searchParams.get('placeId');
  const serviceProviderId = searchParams.get('service_provider_id') || searchParams.get('serviceProviderId');
  const listingId = searchParams.get('listing_id') || searchParams.get('listingId');

  const extractNumericId = (str: string | null): number | null => {
    if (!str) return null;
    const match = str.match(/\d+/);
    return match ? Number(match[0]) : null;
  };

  const numericPlaceId = placeId ? Number(placeId) : extractNumericId(listingId);

  // 1. Try querying by listing_id first (if listing_id column exists in DB)
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

  // 2. Query by place_id (using numericPlaceId)
  if (numericPlaceId) {
    const { data: placeData, error: placeError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('place_id', numericPlaceId)
      .order('created_at', { ascending: false });

    if (!placeError && placeData) {
      const enriched = await enrichReviewsWithUserData(placeData);
      return NextResponse.json({ reviews: enriched });
    }
  }

  // 3. Fallback to all reviews
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
      listing_id,
      listingId,
      rating,
      comment,
      reviewer_name,
      reviewer_image,
      reviewerName,
      reviewerImage,
    } = body;

    const targetListingId = listing_id || listingId || (place_id ? String(place_id) : 'default');
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

    const matchNum = targetListingId ? targetListingId.match(/\d+/) : null;
    const extractedPlaceId = place_id ? Number(place_id) : (matchNum ? Number(matchNum[0]) : null);

    // Validate that place_id exists in pet_friendly_places table if provided
    if (extractedPlaceId && !isNaN(extractedPlaceId)) {
      const { data: placeExists } = await supabaseAdmin
        .from('pet_friendly_places')
        .select('pet_friendly_place_id')
        .eq('pet_friendly_place_id', extractedPlaceId)
        .maybeSingle();

      if (!placeExists) {
        return NextResponse.json(
          {
            error: `Invalid place_id (${extractedPlaceId}): Place with this ID does not exist in pet_friendly_places table.`
          },
          { status: 400 }
        );
      }
    }

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
