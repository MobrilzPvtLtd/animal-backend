import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { requireRoles } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const verifiedOnly = request.nextUrl.searchParams.get('verified_only') === 'true';

  let query = supabaseAdmin.from('rescue_centres').select('*').order('name');
  if (verifiedOnly) {
    query = query.eq('is_verified', true);
  }
  if (search) {
    query = query.ilike('name', `%${search}%`).or(`description.ilike.%${search}%`).or(`address.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rescueCentres: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  const { name, description, address, phone, website, is_verified = false } = await request.json();
  if (!name || !address) {
    return NextResponse.json({ error: 'Name and address are required' }, { status: 400 });
  }

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Check for duplicate name (case-insensitive)
  const { data: existing, error: checkError } = await supabaseAdmin
    .from('rescue_centres')
    .select('rescue_centre_id')
    .ilike('name', trimmedName)
    .limit(1);

  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 });
  }

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'A rescue centre with this name already exists' },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('rescue_centres')
    .insert([{ name: trimmedName, description, address, phone, website, is_verified }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rescueCentre: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner', 'Manager']);
  if ('status' in auth) return auth;

  const rescueCentreId = request.nextUrl.searchParams.get('rescue_centre_id');
  if (!rescueCentreId) {
    return NextResponse.json({ error: 'rescue_centre_id is required' }, { status: 400 });
  }

  const updates = await request.json();

  if (updates.name && typeof updates.name === 'string') {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    const { data: existing, error: checkError } = await supabaseAdmin
      .from('rescue_centres')
      .select('rescue_centre_id')
      .ilike('name', trimmedName)
      .neq('rescue_centre_id', rescueCentreId)
      .limit(1);

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A rescue centre with this name already exists' },
        { status: 409 }
      );
    }

    updates.name = trimmedName;
  }

  const { data, error } = await supabaseAdmin
    .from('rescue_centres')
    .update(updates)
    .eq('rescue_centre_id', rescueCentreId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rescueCentre: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const rescueCentreId = request.nextUrl.searchParams.get('rescue_centre_id');
  if (!rescueCentreId) {
    return NextResponse.json({ error: 'rescue_centre_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('rescue_centres').delete().eq('rescue_centre_id', rescueCentreId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
