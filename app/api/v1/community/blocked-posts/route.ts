import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

// GET /api/v1/community/blocked-posts
// Returns the list of Community Posts that were blocked by the logged-in user
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || !currentUser.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = currentUser.internalUserId;

    // 1. Fetch user_blocks records for current user
    const { data: blockRows, error: blockErr } = await supabaseAdmin
      .from('user_blocks')
      .select('*')
      .eq('user_id', userId);

    if (blockErr) {
      return NextResponse.json({ error: blockErr.message }, { status: 500 });
    }

    if (!blockRows || blockRows.length === 0) {
      return NextResponse.json({ success: true, blocked_posts: [] });
    }

    const blockedUserIds = Array.from(
      new Set((blockRows || []).map((b: any) => b.blocked_user_id).filter(Boolean))
    );
    const blockedPostIds = Array.from(
      new Set((blockRows || []).map((b: any) => b.post_id).filter(Boolean))
    );

    if (blockedUserIds.length === 0 && blockedPostIds.length === 0) {
      return NextResponse.json({ success: true, blocked_posts: [] });
    }

    // 2. Fetch community posts authored by blocked users or blocked post_ids
    let query = supabaseAdmin
      .from('community_posts')
      .select('*, users!user_id(user_id, user_name, name, surname, profile_image_url)')
      .order('created_at', { ascending: false });

    if (blockedPostIds.length > 0 && blockedUserIds.length > 0) {
      query = query.or(`post_id.in.(${blockedPostIds.join(',')}),user_id.in.(${blockedUserIds.join(',')})`);
    } else if (blockedPostIds.length > 0) {
      query = query.in('post_id', blockedPostIds);
    } else {
      query = query.in('user_id', blockedUserIds);
    }

    const { data: posts, error: postsErr } = await query;

    if (postsErr) {
      return NextResponse.json({ error: postsErr.message }, { status: 500 });
    }

    const formattedPosts = (posts || []).map((post: any) => {
      const blockInfo = (blockRows || []).find(
        (b: any) => (b.post_id && b.post_id === post.post_id) || b.blocked_user_id === post.user_id
      );

      return {
        post_id: post.post_id,
        user_id: post.user_id,
        title: post.title || null,
        body: post.body || '',
        image_url: post.image_url || null,
        images:
          Array.isArray(post.images) && post.images.length > 0
            ? post.images
            : post.image_url
            ? [post.image_url]
            : [],
        created_at: post.created_at,
        blocked_at: blockInfo?.created_at || post.created_at,
        user: post.users
          ? {
              user_id: post.users.user_id,
              user_name: post.users.user_name || null,
              name: post.users.name || null,
              surname: post.users.surname || null,
              full_name: post.users.name
                ? `${post.users.name} ${post.users.surname || ''}`.trim()
                : null,
              profile_image_url: post.users.profile_image_url || null,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      blocked_posts: formattedPosts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch blocked community posts' },
      { status: 500 }
    );
  }
}
