import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/booster/my-boosts
 *
 * Returns all boosts purchased by the currently authenticated subscriber.
 * 
 * Query params:
 *   active_only=true   – only return boosts that are currently active & not expired
 *
 * Response:
 *   { boosts: [...] }
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const activeOnly = request.nextUrl.searchParams.get('active_only') === 'true';

  let query = supabaseAdmin
    .from('entity_boosts')
    .select(
      `*,
       boost_packages(*),
       service_providers(service_provider_id, name, image_url, phone, email),
       pet_friendly_places:pet_friendly_places(pet_friendly_place_id, name, image_url, address),
       vets(vet_id, name, image_url, phone)`
    )
    .eq('boosted_by_user_id', user.internalUserId)
    .order('created_at', { ascending: false });

  if (activeOnly) {
    const now = new Date().toISOString();
    query = query
      .eq('is_active', true)
      .or(`end_date.is.null,end_date.gt.${now}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching my boosts:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ boosts: data || [] });
}
