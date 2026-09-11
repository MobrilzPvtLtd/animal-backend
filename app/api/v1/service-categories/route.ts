import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { requireRoles } from '@/lib/server-auth';

// Disable Next.js fetch cache so DB updates are immediately reflected
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const categoryId = request.nextUrl.searchParams.get('service_category_id');
  const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';
  const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';

  if (categoryId) {
    let catQuery = supabaseAdmin
      .from('service_categories')
      .select('*')
      .eq('service_category_id', Number(categoryId));

    if (!includeInactive && activeOnly) {
      catQuery = catQuery.eq('is_active', true);
    }

    const { data: category, error } = await catQuery.maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!category) {
      return NextResponse.json({ error: 'Service category not found' }, { status: 404 });
    }

    const catIdNum = Number(categoryId);
    const { data: junctionRows } = await supabaseAdmin
      .from('service_provider_categories')
      .select('service_provider_id')
      .eq('service_category_id', catIdNum);

    const linkedProviderIds = (junctionRows || []).map((r: any) => r.service_provider_id).filter(Boolean);

    let providerQuery = supabaseAdmin
      .from('service_providers')
      .select('*, service_categories(*), service_provider_images(*), services(*)')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('name');

    if (!includeInactive && activeOnly) {
      providerQuery = providerQuery.or('is_active.eq.true,is_active.is.null');
    }

    if (linkedProviderIds.length > 0) {
      providerQuery = providerQuery.or(`service_category_id.eq.${catIdNum},service_provider_id.in.(${linkedProviderIds.join(',')})`);
    } else {
      providerQuery = providerQuery.eq('service_category_id', catIdNum);
    }

    const { data: providers } = await providerQuery;

    return NextResponse.json({ category: { ...category, service_providers: providers || [] } });
  }

  let query = supabaseAdmin
    .from('service_categories')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name');

  if (!includeInactive && activeOnly) {
    query = query.eq('is_active', true);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`).or(`description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }
  if (!rawBody || !rawBody.trim()) {
    return NextResponse.json({ error: 'Request body is empty. Send a valid JSON object.' }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { name, description, icon, image_url, color, is_active, sort_order } = body;
  if (!name) {
    return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
  }

  const insertData: Record<string, any> = { name };
  if (description !== undefined) insertData.description = description;
  if (icon !== undefined) insertData.icon = icon;
  if (image_url !== undefined) insertData.image_url = image_url;
  if (color !== undefined) insertData.color = color;
  if (is_active !== undefined) insertData.is_active = is_active;
  if (sort_order !== undefined) insertData.sort_order = sort_order;

  const { data, error } = await supabaseAdmin
    .from('service_categories')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  const categoryId = request.nextUrl.searchParams.get('service_category_id');
  if (!categoryId) {
    return NextResponse.json({ error: 'service_category_id is required' }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }
  if (!rawBody || !rawBody.trim()) {
    return NextResponse.json({ error: 'Request body is empty. Send a valid JSON object.' }, { status: 400 });
  }
  let updates: Record<string, unknown>;
  try {
    updates = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('service_categories')
    .update(updates)
    .eq('service_category_id', categoryId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const categoryId = request.nextUrl.searchParams.get('service_category_id');
  if (!categoryId) {
    return NextResponse.json({ error: 'service_category_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('service_categories').delete().eq('service_category_id', categoryId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
