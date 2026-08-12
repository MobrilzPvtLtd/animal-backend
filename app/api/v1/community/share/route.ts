import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

// POST /api/v1/community/share
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const postId = body?.post_id;

    if (!postId || isNaN(Number(postId))) {
      return NextResponse.json({ error: 'Valid post_id is required' }, { status: 400 });
    }

    // Verify post exists
    const { data: post, error: fetchError } = await supabaseAdmin
      .from('community_posts')
      .select('post_id, title')
      .eq('post_id', Number(postId))
      .maybeSingle();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Post shared successfully',
      post_id: Number(postId),
      shared_by_user_id: user?.internalUserId || null,
      share_link: `https://animal-backend-nine.vercel.app/community/posts/${postId}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to share post' }, { status: 500 });
  }
}
