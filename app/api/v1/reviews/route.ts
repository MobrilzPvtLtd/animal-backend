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
  const listingType = searchParams.get('listing_type') || searchParams.get('listingType') || searchParams.get('type');

  let targetListingId = listingId || (placeId ? String(placeId) : (serviceProviderId ? String(serviceProviderId) : null));
  let targetListingType = listingType || (serviceProviderId ? 'service_provider' : (placeId ? 'pet_friendly' : null));

  // 1. If specific listing_id filter is requested
  if (targetListingId) {
    let query = supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('listing_id', targetListingId);

    if (targetListingType) {
      query = query.eq('listing_type', targetListingType);
    }

    const { data: listingData, error: listingError } = await query.order('created_at', { ascending: false });

    if (!listingError && listingData) {
      const enriched = await enrichReviewsWithUserData(listingData);
      return NextResponse.json({ reviews: enriched });
    }

    // Fallback if listing_type column isn't in DB schema yet
    if (listingError && targetListingType) {
      const { data: fallbackData, error: fallbackErr } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('listing_id', targetListingId)
        .order('created_at', { ascending: false });

      if (!fallbackErr && fallbackData) {
        const enriched = await enrichReviewsWithUserData(fallbackData);
        return NextResponse.json({ reviews: enriched });
      }
    }

    return NextResponse.json({ reviews: [] });
  }

  // 2. Query by place_id legacy column fallback
  if (placeId && !isNaN(Number(placeId))) {
    const { data: placeData, error: placeError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('place_id', Number(placeId))
      .order('created_at', { ascending: false });

    if (!placeError && placeData) {
      const enriched = await enrichReviewsWithUserData(placeData);
      return NextResponse.json({ reviews: enriched });
    }

    return NextResponse.json({ reviews: [] });
  }

  // 3. Fallback to all reviews (only when no filter parameters are passed at all)
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
      listing_type,
      listingType,
      type,
      id,
      itemId,
      item_id,
      entityId,
      entity_id,
      targetId,
      target_id,
      rating,
      comment,
      reviewer_name,
      reviewer_image,
      reviewerName,
      reviewerImage,
    } = body;

    const rawPlaceId = place_id || placeId || pet_friendly_place_id || petFriendlyPlaceId;
    const rawServiceProviderId = service_provider_id || serviceProviderId || provider_id || providerId;
    const rawGenericId = id || itemId || item_id || entityId || entity_id || targetId || target_id;
    const rawListingId = listing_id || listingId;

    const targetListingId =
      rawListingId ? String(rawListingId) :
      rawServiceProviderId ? String(rawServiceProviderId) :
      rawPlaceId ? String(rawPlaceId) :
      rawGenericId ? String(rawGenericId) :
      'default';

    const targetListingType =
      listing_type || listingType || type ||
      (rawServiceProviderId ? 'service_provider' : (rawPlaceId ? 'pet_friendly' : 'pet_friendly'));

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

    // Payload - place_id is strictly null as requested
    const fullPayload: Record<string, any> = {
      user_id: targetUserId,
      place_id: null,
      listing_id: targetListingId,
      listing_type: targetListingType,
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

    // Fallback insertion if listing_type column is not yet in schema cache
    console.warn('Full review insert failed, attempting fallback insert:', fullError?.message);

    const basePayload: Record<string, any> = {
      user_id: targetUserId,
      place_id: null,
      listing_id: targetListingId,
      rating: targetRating,
      comment: cleanComment,
      reviewer_name: name,
      reviewer_image: image,
      likes: 0,
      is_approved: true,
    };

    const { data: baseData, error: baseError } = await supabaseAdmin
      .from('reviews')
      .insert([basePayload])
      .select()
      .single();

    if (baseError) {
      // If unique constraint is hit, update the existing review
      const isDuplicate =
        baseError.code === '23505' ||
        baseError.message?.includes('unique constraint');

      if (isDuplicate && targetUserId && targetListingId) {
        const { data: updatedData, error: updateErr } = await supabaseAdmin
          .from('reviews')
          .update({
            rating: targetRating,
            comment: cleanComment,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', targetUserId)
          .eq('listing_id', targetListingId)
          .select()
          .maybeSingle();

        if (!updateErr && updatedData) {
          return NextResponse.json(
            {
              success: true,
              message: 'Thank you! Your review has been updated.',
              review: {
                ...updatedData,
                listing_id: targetListingId,
                listing_type: targetListingType,
                reviewer_name: name,
                reviewer_image: image,
              },
              flaggedWords: [],
            },
            { status: 200 }
          );
        }
      }

      console.error('Review insert failed:', baseError.message);
      return NextResponse.json({ error: baseError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Your review has been published.',
        review: {
          ...baseData,
          listing_id: targetListingId,
          listing_type: targetListingType,
          reviewer_name: name,
          reviewer_image: image,
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
  const auth = await requireRoles(request, ['Admin', 'Owner']);
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
