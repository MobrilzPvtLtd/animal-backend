import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { normalizePlaceImages } from '@/lib/image-normalizer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: place, error } = await supabaseAdmin
    .from('pet_friendly_places')
    .select(`*, place_groups(group:groups(*))`)
    .eq('pet_friendly_place_id', params.id)
    .single();

  if (error || !place) {
    return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  }

  return NextResponse.json({ place: normalizePlaceImages(place) });
}
