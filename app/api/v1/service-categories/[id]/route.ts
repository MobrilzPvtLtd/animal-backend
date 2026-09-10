import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';
  const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'Invalid service category ID' }, { status: 400 });
  }

  let catQuery = supabaseAdmin
    .from('service_categories')
    .select('*')
    .eq('service_category_id', Number(id));

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

  const catIdNum = Number(id);
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
