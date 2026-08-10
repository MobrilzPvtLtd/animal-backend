import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .select(`
      *,
      location:locations(*),
      service_provider:service_providers(
        name,
        service_provider_id
      ),
      event_category:event_categories(
        name,
        event_category_id,
        icon,
        color
      )
    `)
    .eq('event_id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const approvedOnlyParam = request.nextUrl.searchParams.get('approved_only');
  const approvedOnly = approvedOnlyParam !== 'false';

  if (!data || (approvedOnly && !data.is_approved)) {
    return NextResponse.json({ error: 'Event not found or pending approval' }, { status: 404 });
  }

  return NextResponse.json({ event: data });
}
