import { NextRequest, NextResponse } from 'next/server';
import { hashRefreshToken, setCurrentTokenHashes } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/server-supabase';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const refresh_token = body?.refresh_token ?? body?.refreshToken ?? body?.session?.refresh_token;

  if (!refresh_token) {
    return NextResponse.json(
      { error: 'refresh_token is required', details: 'Send refresh_token, refreshToken, or session.refresh_token in the request body' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });

  if (error || !data?.session) {
    return NextResponse.json(
      {
        error: error?.message || 'Unable to refresh session',
        details: error ?? null,
      },
      { status: 401 }
    );
  }

  if (data?.user?.id && data?.session?.access_token && data?.session?.refresh_token) {
    try {
      await setCurrentTokenHashes(data.user.id, data.session.access_token, data.session.refresh_token, {
        skipTerminateOtherSessions: true,
      });
    } catch (hashErr) {
      console.warn('Failed to update token hashes on refresh:', hashErr);
    }
  }

  return NextResponse.json({
    message: 'Token refreshed successfully',
    session: data.session,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in ?? 2592000,
    expires_at: data.session.expires_at ?? (Math.floor(Date.now() / 1000) + 2592000),
    user: data.user,
  });
}
