import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { requireRoles } from '@/lib/server-auth';

// Disable Next.js fetch cache so DB updates are immediately reflected
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';
  const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';
  let query = supabaseAdmin.from('groups').select('*').order('name');

  if (!includeInactive && activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ groups: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const body = await request.json();
  const { name, description, is_active = true } = body;
  if (!name) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('groups')
    .insert([{ name, description, is_active }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ group: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const groupId = request.nextUrl.searchParams.get('group_id');
  if (!groupId) {
    return NextResponse.json({ error: 'group_id is required' }, { status: 400 });
  }

  const updates = await request.json();
  const { data, error } = await supabaseAdmin
    .from('groups')
    .update(updates)
    .eq('group_id', groupId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ group: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const groupId = request.nextUrl.searchParams.get('group_id');
  if (!groupId) {
    return NextResponse.json({ error: 'group_id is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('groups')
    .update({ is_active: false })
    .eq('group_id', groupId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ group: data });
}
