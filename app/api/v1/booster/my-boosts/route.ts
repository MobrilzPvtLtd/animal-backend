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
function formatBoosts(data: any[]) {
  return data.map((item) => {
    const boost = { ...item };
    if (boost.service_providers) {
      const sp = boost.service_providers;
      boost.service_providers = {
        service_provider_id: sp.service_provider_id,
        name: sp.name,
        image_url: sp.image_url,
        phone: sp.phone,
        email: sp.email,
        address: sp.locations?.address || sp.address || null,
      };
    }
    if (boost.vets) {
      const vet = boost.vets;
      const firstImg = Array.isArray(vet.images) && vet.images.length > 0
        ? vet.images[0]
        : (typeof vet.images === 'string' ? vet.images : null);
      boost.vets = {
        vet_id: vet.vet_id,
        name: vet.name,
        phone: vet.phone,
        address: vet.address,
        clinic_name: vet.clinic_name,
        image_url: vet.image_url || firstImg,
      };
    }
    return boost;
  });
}

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
       service_providers(service_provider_id, name, image_url, phone, email, locations(address)),
       pet_friendly_places(pet_friendly_place_id, name, image_url, address, phone),
       vets(vet_id, name, phone, address, clinic_name, images)`
    )
    .eq('boosted_by_user_id', user.internalUserId)
    .order('created_at', { ascending: false });

  if (activeOnly) {
    const now = new Date().toISOString();
    query = query
      .eq('is_active', true)
      .or(`end_date.is.null,end_date.gt.${now}`);
  }

  let { data, error } = await query;

  if (error) {
    console.warn('Embedded my-boosts query failed, falling back to manual hydration:', error.message);

    let fallbackQuery = supabaseAdmin
      .from('entity_boosts')
      .select('*, boost_packages(*)')
      .eq('boosted_by_user_id', user.internalUserId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      const now = new Date().toISOString();
      fallbackQuery = fallbackQuery
        .eq('is_active', true)
        .or(`end_date.is.null,end_date.gt.${now}`);
    }

    const fallbackRes = await fallbackQuery;
    if (fallbackRes.error) {
      return NextResponse.json({ error: fallbackRes.error.message }, { status: 500 });
    }

    const rawBoosts = fallbackRes.data || [];
    const spIds = Array.from(new Set(rawBoosts.map((b: any) => b.service_provider_id).filter(Boolean)));
    const vetIds = Array.from(new Set(rawBoosts.map((b: any) => b.vet_id).filter(Boolean)));
    const placeIds = Array.from(new Set(rawBoosts.map((b: any) => b.pet_friendly_place_id).filter(Boolean)));

    const [spRes, vetsRes, placesRes] = await Promise.all([
      spIds.length
        ? supabaseAdmin.from('service_providers').select('service_provider_id, name, image_url, phone, email, locations(address)').in('service_provider_id', spIds)
        : { data: [] },
      vetIds.length
        ? supabaseAdmin.from('vets').select('vet_id, name, phone, address, clinic_name, images').in('vet_id', vetIds)
        : { data: [] },
      placeIds.length
        ? supabaseAdmin.from('pet_friendly_places').select('pet_friendly_place_id, name, image_url, address, phone').in('pet_friendly_place_id', placeIds)
        : { data: [] },
    ]);

    const spMap = new Map((spRes.data || []).map((sp: any) => [sp.service_provider_id, sp]));
    const vetMap = new Map((vetsRes.data || []).map((v: any) => [v.vet_id, v]));
    const placeMap = new Map((placesRes.data || []).map((p: any) => [p.pet_friendly_place_id, p]));

    data = rawBoosts.map((b: any) => ({
      ...b,
      service_providers: b.service_provider_id ? spMap.get(b.service_provider_id) || null : null,
      vets: b.vet_id ? vetMap.get(b.vet_id) || null : null,
      pet_friendly_places: b.pet_friendly_place_id ? placeMap.get(b.pet_friendly_place_id) || null : null,
    }));
  }

  return NextResponse.json({ boosts: formatBoosts(data || []) });
}
