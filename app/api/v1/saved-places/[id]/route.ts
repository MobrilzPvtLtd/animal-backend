import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/saved-places/[id]
 * Checks whether a specific place is saved/liked by the authenticated user.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid place id is required' }, { status: 400 });
    }

    const userId = Number(user.internalUserId);
    const placeId = Number(id);

    const { data: saved, error } = await supabaseAdmin
      .from('saved_places')
      .select('user_id, place_id, created_at')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle();

    if (error) {
      console.error('Error checking saved place status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      place_id: placeId,
      is_saved: !!saved,
      is_liked: !!saved,
      saved_at: saved?.created_at || null,
    });
  } catch (error: any) {
    console.error('Unexpected error checking saved place status:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check saved place status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/saved-places/[id]
 * Removes a specific place by id from the authenticated user's saved places.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid place id is required' }, { status: 400 });
    }

    const userId = Number(user.internalUserId);
    const placeId = Number(id);

    const { error: deleteError } = await supabaseAdmin
      .from('saved_places')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId);

    if (deleteError) {
      console.error('Error deleting saved place:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Place removed from saved places successfully',
      is_saved: false,
      is_liked: false,
      place_id: placeId,
    });
  } catch (error: any) {
    console.error('Unexpected error deleting saved place:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to remove saved place' },
      { status: 500 }
    );
  }
}
