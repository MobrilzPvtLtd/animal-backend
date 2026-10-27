import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { deleteAnimalImageByUrl, uploadAnimalImage } from '@/lib/storage-upload';
import { getUserFromRequest, requireRoles } from '@/lib/server-auth';

type CommunityPayload = {
  title?: string;
  body?: string;
  images?: string[];
  image_url?: string;
  formData?: FormData;
};

async function readPayload(request: NextRequest): Promise<CommunityPayload> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const titleVal = formData.get('title');
    const bodyVal = formData.get('body');

    return {
      title: typeof titleVal === 'string' ? titleVal.trim() : undefined,
      body: typeof bodyVal === 'string' ? bodyVal.trim() : undefined,
      formData,
    };
  }

  try {
    const json = await request.json();
    return {
      title: typeof json.title === 'string' ? json.title.trim() : undefined,
      body: typeof json.body === 'string' ? json.body.trim() : undefined,
      images: Array.isArray(json.images) ? json.images : undefined,
      image_url: typeof json.image_url === 'string' ? json.image_url : undefined,
    };
  } catch {
    return {};
  }
}

async function resolveCommunityImages(payload: CommunityPayload): Promise<string[]> {
  const uploadedUrls: string[] = [];

  // 1. Process Form Data (Multiple file uploads or image strings)
  if (payload.formData) {
    const entries = Array.from(payload.formData.entries());

    for (const [key, value] of entries) {
      if (value instanceof File && value.size > 0) {
        try {
          const uploadResult = await uploadAnimalImage(value, 'community_posts');
          if (uploadResult?.url) {
            uploadedUrls.push(uploadResult.url);
          }
        } catch (uploadErr) {
          console.error(`Failed to upload file key "${key}":`, uploadErr);
        }
      } else if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        if (key === 'images' || key === 'image_url' || key === 'imageUrl') {
          if (trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  if (typeof item === 'string' && item.trim()) {
                    uploadedUrls.push(item.trim());
                  }
                }
              }
            } catch {
              uploadedUrls.push(trimmed);
            }
          } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
            uploadedUrls.push(trimmed);
          }
        }
      }
    }
  }

  // 2. Process JSON Payload images
  if (payload.images && Array.isArray(payload.images)) {
    for (const item of payload.images) {
      if (typeof item === 'string' && item.trim()) {
        uploadedUrls.push(item.trim());
      }
    }
  }

  if (payload.image_url && typeof payload.image_url === 'string' && payload.image_url.trim()) {
    uploadedUrls.push(payload.image_url.trim());
  }

  return Array.from(new Set(uploadedUrls));
}

export async function GET(request: NextRequest) {
  const currentUser = await getUserFromRequest(request);
  if (!currentUser || !currentUser.internalUserId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get('search');
  const userIdParam = request.nextUrl.searchParams.get('user_id');

  let query = supabaseAdmin
    .from('community_posts')
    .select('*, post_likes(reaction), community_comments(user_id,comment,created_at,updated_at,users ( name )), users!user_id ( profile_image_url,user_name )')
    .order('created_at', { ascending: false });

  // Filter out posts from users blocked by current user
  const { data: blockedRows } = await supabaseAdmin
    .from('user_blocks')
    .select('blocked_user_id')
    .eq('user_id', currentUser.internalUserId);

  if (blockedRows && blockedRows.length > 0) {
    const blockedUserIds = Array.from(new Set(blockedRows.map((r: any) => r.blocked_user_id).filter(Boolean)));
    if (blockedUserIds.length > 0) {
      query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
    }
  }

  if (userIdParam === 'me') {
    query = query.eq('user_id', currentUser.internalUserId);
  } else if (userIdParam && !isNaN(Number(userIdParam))) {
    query = query.eq('user_id', Number(userIdParam));
  }

  if (search) {
    query = query.ilike('title', `%${search}%`).or(`body.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const posts = (data || []).map((post: any) => {
    const likes = Array.isArray(post.post_likes)
      ? (post.post_likes as Array<{ reaction?: string }>)
      : [];

    return {
      ...post,
      images: Array.isArray(post.images) && post.images.length > 0 ? post.images : (post.image_url ? [post.image_url] : []),
      likes_count: likes.filter((item) => item.reaction === 'like').length,
      dislikes_count: likes.filter((item) => item.reaction === 'dislike').length,
      comments_count: Array.isArray(post.community_comments) ? post.community_comments.length : 0,
    };
  });

  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const payload = await readPayload(request);
  const title = payload.title;
  const body = payload.body || '';
  if (!body) {
    return NextResponse.json({ error: 'Post body is required' }, { status: 400 });
  }

  const imagesList = await resolveCommunityImages(payload);
  const primaryImage = imagesList[0] || null;

  const insertPayload: Record<string, unknown> = {
    user_id: user.internalUserId,
    title: title || null,
    body,
    image_url: primaryImage,
    images: imagesList,
  };

  const { data, error } = await supabaseAdmin
    .from('community_posts')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    post: {
      ...data,
      images: Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.image_url ? [data.image_url] : []),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const postId = request.nextUrl.searchParams.get('post_id');
  if (!postId) {
    return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
  }

  const payload = await readPayload(request);
  const canEdit = await supabaseAdmin
    .from('community_posts')
    .select('user_id, image_url, images')
    .eq('post_id', postId)
    .single();

  if (canEdit.error || !canEdit.data) {
    return NextResponse.json({ error: canEdit.error?.message || 'Post not found' }, { status: 404 });
  }

  if (canEdit.data.user_id !== user.internalUserId) {
    const auth = await requireRoles(request, ['Admin', 'Owner']);
    if ('status' in auth) return auth;
  }

  const updates: Record<string, unknown> = {};
  if (payload.title !== undefined) {
    updates.title = payload.title || null;
  }
  if (payload.body !== undefined) {
    updates.body = payload.body;
  }

  const imagesList = await resolveCommunityImages(payload);
  if (imagesList.length > 0) {
    updates.images = imagesList;
    updates.image_url = imagesList[0] || null;
  }

  const { data, error } = await supabaseAdmin
    .from('community_posts')
    .update(updates)
    .eq('post_id', postId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    post: {
      ...data,
      images: Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.image_url ? [data.image_url] : []),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const postId = request.nextUrl.searchParams.get('post_id');
  if (!postId) {
    return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
  }

  const canDelete = await supabaseAdmin
    .from('community_posts')
    .select('user_id, image_url, images')
    .eq('post_id', postId)
    .single();

  if (canDelete.error || !canDelete.data) {
    return NextResponse.json({ error: canDelete.error?.message || 'Post not found' }, { status: 404 });
  }

  if (canDelete.data.user_id !== user.internalUserId) {
    const auth = await requireRoles(request, ['Admin', 'Owner']);
    if ('status' in auth) return auth;
  }

  const postImageUrl = canDelete.data.image_url;
  const postImages = Array.isArray(canDelete.data.images) ? canDelete.data.images : [];

  const { error } = await supabaseAdmin.from('community_posts').delete().eq('post_id', postId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cleanup storage images
  const allImageUrls = Array.from(new Set([postImageUrl, ...postImages].filter(Boolean))) as string[];
  for (const imgUrl of allImageUrls) {
    try {
      await deleteAnimalImageByUrl(imgUrl);
    } catch (cleanupError) {
      console.warn('Failed to clean up deleted community post image:', cleanupError);
    }
  }

  return NextResponse.json({ success: true });
}
