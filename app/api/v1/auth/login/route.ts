import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/server-supabase';
import { buildAuthProfile } from '@/lib/auth-profile';
import { setCurrentTokenHashes } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    return handleLogin(email, password);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Login failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function handleLogin(email: string, password: string) {
  try {
    // 1. Attempt sign in directly with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

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
      await setCurrentTokenHashes(data.user.id, data.session.access_token, data.session.refresh_token);
    }

    // 3. Build auth profile – same as before
    const authProfile = data?.user
      ? await buildAuthProfile({
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
        })
      : null;

    return NextResponse.json(
      { user: data?.user ?? null, session: data?.session ?? null, ...authProfile },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Login exception:', err);
    return NextResponse.json({ error: 'Login error' }, { status: 500 });
  }
}
