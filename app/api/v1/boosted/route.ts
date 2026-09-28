import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { requireRoles } from '@/lib/server-auth';

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
  const search = request.nextUrl.searchParams.get('search');
  const activeOnly = request.nextUrl.searchParams.get('active_only') === 'true';
  const entityType = request.nextUrl.searchParams.get('entity_type');
  const groupBoost = request.nextUrl.searchParams.get('group_boost');

  let query = supabaseAdmin
    .from('entity_boosts')
    .select(
      `*, boost_packages(*),
       service_providers(service_provider_id, name, image_url, phone, email, locations(address)),
       vets(vet_id, name, phone, address, clinic_name, images),
       pet_friendly_places(pet_friendly_place_id, name, image_url, address, phone)`
    )
    .order('created_at', { ascending: false });

  if (activeOnly) {
    const now = new Date().toISOString();
    query = query
      .eq('is_active', true)
      .or(`end_date.is.null,end_date.gt.${now}`);
  }
  if (entityType) {
    query = query.eq('entity_type', entityType);
  }
  if (groupBoost !== null) {
    query = query.eq('group_boost', groupBoost === 'true');
  }
  if (search) {
    query = query.ilike('entity_type', `%${search}%`);
  }

  let { data, error } = await query;

  // Fallback in case of relationship cache mismatch
  if (error) {
    console.warn('Embedded boost query failed, falling back to manual hydration:', error.message);

    let fallbackQuery = supabaseAdmin
      .from('entity_boosts')
      .select('*, boost_packages(*)')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      const now = new Date().toISOString();
      fallbackQuery = fallbackQuery
        .eq('is_active', true)
        .or(`end_date.is.null,end_date.gt.${now}`);
    }
    if (entityType) {
      fallbackQuery = fallbackQuery.eq('entity_type', entityType);
    }
    if (groupBoost !== null) {
      fallbackQuery = fallbackQuery.eq('group_boost', groupBoost === 'true');
    }
    if (search) {
      fallbackQuery = fallbackQuery.ilike('entity_type', `%${search}%`);
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

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  const { boost_package_id, entity_type, vet_id, breeder_id, pet_friendly_place_id, service_provider_id, start_date, end_date } = await request.json();
  if (!boost_package_id || !entity_type) {
    return NextResponse.json({ error: 'boost_package_id and entity_type are required' }, { status: 400 });
  }

  const packageResult = await supabaseAdmin
    .from('boost_packages')
    .select('duration_days')
    .eq('boost_package_id', boost_package_id)
    .single();

  if (packageResult.error || !packageResult.data) {
    return NextResponse.json({ error: packageResult.error?.message || 'Boost package not found' }, { status: 404 });
  }

  const finalStartDate = start_date || new Date().toISOString();
  const finalEndDate = end_date || new Date(Date.now() + (Number(packageResult.data.duration_days) || 30) * 24 * 60 * 60 * 1000).toISOString();

  const insertData: any = {
    boost_package_id,
    entity_type,
    start_date: finalStartDate,
    end_date: finalEndDate,
    is_active: true,
  };

  if (vet_id) insertData.vet_id = vet_id;
  if (breeder_id) insertData.breeder_id = breeder_id;
  if (pet_friendly_place_id) insertData.pet_friendly_place_id = pet_friendly_place_id;
  if (service_provider_id) insertData.service_provider_id = service_provider_id;

  const { data, error } = await supabaseAdmin
    .from('entity_boosts')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ boost: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  const boostId = request.nextUrl.searchParams.get('entity_boost_id');
  if (!boostId) {
    return NextResponse.json({ error: 'entity_boost_id is required' }, { status: 400 });
  }

  const updates = await request.json();
  const { data, error } = await supabaseAdmin
    .from('entity_boosts')
    .update(updates)
    .eq('entity_boost_id', boostId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ boost: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const boostId = request.nextUrl.searchParams.get('entity_boost_id');
  if (!boostId) {
    return NextResponse.json({ error: 'entity_boost_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('entity_boosts').delete().eq('entity_boost_id', boostId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
