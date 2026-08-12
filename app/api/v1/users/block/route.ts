import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

// GET /api/v1/users/block - Get list of blocked users for logged in user
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: blockedList, error } = await supabaseAdmin
      .from('user_blocks')
      .select('block_id, blocked_user_id, created_at, blocked_user:users!blocked_user_id(user_id, user_name, name, profile_image_url)')
      .eq('blocker_user_id', user.internalUserId);

    if (error) {
      // Fallback if column name is user_id instead of blocker_user_id
      const { data: fallbackList, error: fallbackError } = await supabaseAdmin
        .from('user_blocks')
        .select('*')
        .eq('user_id', user.internalUserId);

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }

      return NextResponse.json({ blocked_users: fallbackList || [] });
    }

    return NextResponse.json({ blocked_users: blockedList || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch blocked users' }, { status: 500 });
  }
}

// POST /api/v1/users/block - Block or Unblock another user
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const blockedUserId = body?.blocked_user_id || body?.user_id;
    const action = body?.action || 'block'; // 'block' or 'unblock'

    if (!blockedUserId || isNaN(Number(blockedUserId))) {
      return NextResponse.json({ error: 'Valid blocked_user_id is required' }, { status: 400 });
    }

    const blockerId = Number(user.internalUserId);
    const targetId = Number(blockedUserId);

    if (blockerId === targetId) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
    }

    // Check if target user exists
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('user_id, user_name, name')
      .eq('user_id', targetId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User to block not found' }, { status: 404 });
    }

    // Check existing block
    const { data: existingBlock } = await supabaseAdmin
      .from('user_blocks')
      .select('block_id')
      .or(`and(blocker_user_id.eq.${blockerId},blocked_user_id.eq.${targetId}),and(user_id.eq.${blockerId},blocked_user_id.eq.${targetId})`)
      .maybeSingle();

    if (action === 'unblock') {
      if (existingBlock) {
        await supabaseAdmin
          .from('user_blocks')
          .delete()
          .eq('block_id', existingBlock.block_id);
      }

      return NextResponse.json({
        success: true,
        message: `User ${targetUser.user_name || targetUser.name || targetId} unblocked successfully`,
        is_blocked: false,
      });
    }

    // Default action: block
    if (existingBlock) {
      return NextResponse.json({
        success: true,
        message: `User ${targetUser.user_name || targetUser.name || targetId} is already blocked`,
        is_blocked: true,
      });
    }

    const insertData: Record<string, unknown> = {
      blocker_user_id: blockerId,
      blocked_user_id: targetId,
      user_id: blockerId,
    };

    const { data: newBlock, error: insertError } = await supabaseAdmin
      .from('user_blocks')
      .insert([insertData])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.user_name || targetUser.name || targetId} blocked successfully`,
      is_blocked: true,
      block: newBlock,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to process block request' }, { status: 500 });
  }
}
