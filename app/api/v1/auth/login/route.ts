import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/server-supabase';
import { buildAuthProfile } from '@/lib/auth-profile';
import { setCurrentTokenHashes } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, device_id, device_type } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const headerDeviceType = request.headers.get('x-device-type') || request.headers.get('x-platform');
    const headerDeviceId = request.headers.get('x-device-id');

    return handleLogin(email, password, {
      device_id: device_id || headerDeviceId || null,
      device_type: device_type || headerDeviceType || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Login failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function handleLogin(
  email: string,
  password: string,
  deviceInfo?: { device_id?: string | null; device_type?: string | null }
) {
  try {
    // 1. Attempt sign in directly with Supabase Auth
    let { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    // If email is not confirmed, auto-confirm via admin API and retry
    if (error?.message?.toLowerCase().includes('email not confirmed')) {
      try {
        // Find the user by email in auth.users
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
        const authUser = userList?.users?.find((u: any) => u.email === email);
        if (authUser?.id) {
          await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
            email_confirm: true,
          });
          // Retry sign in after confirming
          const retryResult = await supabaseAdmin.auth.signInWithPassword({ email, password });
          data = retryResult.data;
          error = retryResult.error;
        }
      } catch (confirmErr: any) {
        console.warn('Auto-confirm failed:', confirmErr?.message);
      }
    }

    if (error || !data?.user) {
      console.error('SignIn error:', error?.message);
      return NextResponse.json({ error: error?.message || 'Invalid login credentials' }, { status: 401 });
    }

    // 2. Ensure public.users record exists and is linked
    let { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('user_id, auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (!existingUser) {
      const metaName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split('@')[0];
      const nameParts = metaName.trim().split(/\s+/);
      const name = nameParts[0];
      const surname = nameParts.slice(1).join(' ') || '';

      const { data: newUser } = await supabaseAdmin
        .from('users')
        .insert({
          auth_user_id: data.user.id,
          email,
          name,
          surname,
          user_type: data.user.user_metadata?.roleName || 'Subscriber',
          is_verified: true,
        })
        .select('user_id, auth_user_id')
        .maybeSingle();

      existingUser = newUser;
    } else if (!existingUser.auth_user_id) {
      await supabaseAdmin
        .from('users')
        .update({ auth_user_id: data.user.id })
        .eq('email', email);
    }

    if (data.session?.access_token && data.session?.refresh_token) {
      try {
        await setCurrentTokenHashes(data.user.id, data.session.access_token, data.session.refresh_token, deviceInfo);
      } catch (tokenErr) {
        console.warn('setCurrentTokenHashes warning:', tokenErr);
      }
    }

    // 3. Build auth profile (with fallback)
    let authProfile: any = null;
    try {
      if (data?.user) {
        authProfile = await buildAuthProfile({
          id: data.user.id,
          email: data.user.email ?? email,
          roleNames: [
            data.user.user_metadata?.roleName,
            data.user.user_metadata?.role_name,
            ...(data.user.user_metadata?.roleNames || []),
            ...(data.user.user_metadata?.role_names || []),
            data.user.app_metadata?.roleName,
            data.user.app_metadata?.role_name,
            ...(data.user.app_metadata?.roleNames || []),
            ...(data.user.app_metadata?.role_names || []),
          ].filter(Boolean) as string[],
        });
      }
    } catch (profileErr) {
      console.warn('buildAuthProfile warning:', profileErr);
    }

    const sessionObj = data.session
      ? {
          ...data.session,
          expires_in: 2592000, // 30 days (720 hours)
          expires_at: Math.floor(Date.now() / 1000) + 2592000,
        }
      : null;

    return NextResponse.json(
      { user: data?.user ?? null, session: sessionObj, ...(authProfile || {}) },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Login exception:', err);
    return NextResponse.json({ error: err?.message || 'Login error' }, { status: 500 });
  }
}
