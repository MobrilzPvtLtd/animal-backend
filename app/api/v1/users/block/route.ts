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
      .select('user_id, blocked_user_id, created_at, blocked_user:users!blocked_user_id(user_id, user_name, name, surname, profile_image_url)')
      .eq('user_id', user.internalUserId);

    if (error) {
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

// POST /api/v1/users/block - Block or Unblock user via post_id or blocked_user_id
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let blockedUserId = body?.blocked_user_id || body?.user_id;
    const postId = body?.post_id;
    const action = body?.action || 'block'; // 'block' or 'unblock'

    // If post_id is passed, get the author (user_id) of the community post
    if (postId && !isNaN(Number(postId)) && (!blockedUserId || isNaN(Number(blockedUserId)))) {
      const { data: post, error: postErr } = await supabaseAdmin
        .from('community_posts')
        .select('user_id, title')
        .eq('post_id', Number(postId))
        .maybeSingle();

      if (postErr || !post) {
        return NextResponse.json({ error: 'Community post not found' }, { status: 404 });
      }

      blockedUserId = post.user_id;
    }

    if (!blockedUserId || isNaN(Number(blockedUserId))) {
      return NextResponse.json({ error: 'Valid post_id or blocked_user_id is required' }, { status: 400 });
    }

    const blockerId = Number(user.internalUserId);
    const targetId = Number(blockedUserId);

    if (blockerId === targetId) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
    }

    // Check if target user exists
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('user_id, user_name, name, surname')
      .eq('user_id', targetId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User to block not found' }, { status: 404 });
    }

    // Check existing block by (user_id, blocked_user_id)
    const { data: existingBlock } = await supabaseAdmin
      .from('user_blocks')
      .select('user_id, blocked_user_id')
      .eq('user_id', blockerId)
      .eq('blocked_user_id', targetId)
      .maybeSingle();

    if (action === 'unblock') {
      if (existingBlock) {
        await supabaseAdmin
          .from('user_blocks')
          .delete()
          .eq('user_id', blockerId)
          .eq('blocked_user_id', targetId);
      }

      return NextResponse.json({
        success: true,
        message: `User ${targetUser.user_name || targetUser.name || targetId} unblocked successfully`,
        is_blocked: false,
        unblocked_user_id: targetId,
      });
    }

    // Default action: block
    if (existingBlock) {
      return NextResponse.json({
        success: true,
        message: `User ${targetUser.user_name || targetUser.name || targetId} is already blocked`,
        is_blocked: true,
        blocked_user_id: targetId,
      });
    }

    const { data: newBlock, error: insertError } = await supabaseAdmin
      .from('user_blocks')
      .insert([
        {
          user_id: blockerId,
          blocked_user_id: targetId,
        },
      ])
      .select()
      .maybeSingle();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.user_name || targetUser.name || targetId} blocked successfully from community post`,
      is_blocked: true,
      blocked_user_id: targetId,
      block: newBlock,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to process block request' }, { status: 500 });
  }
}
