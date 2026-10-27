import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest, requireRoles } from '@/lib/server-auth';
import { isSuperAdmin } from '@/lib/roles';
import { normalizeEmail, emailMatchPattern, isDuplicateAccountError, DUPLICATE_ACCOUNT_MESSAGE } from '@/lib/account-identity';

export async function GET(request: NextRequest) {
  const me = request.nextUrl.searchParams.get('me') === 'true';
  const user = await getUserFromRequest(request);

  if (me) {
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
    .select('user_id, email, name, surname, phone, profile_image_url, subscription_status, subscription_plan, subscription_expires_at, static_location, preferred_radius, notification_preferences, user_type')
    .eq('user_id', user.internalUserId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  }

  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('user_id, email, name, surname, phone, profile_image_url, subscription_status, subscription_plan, subscription_expires_at, static_location, preferred_radius, notification_preferences, user_type')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const body = await request.json();
  const { name, surname, phone, subscription_status, subscription_plan, preferred_radius, user_type } = body;
  const email = normalizeEmail(body.email);

  if (!email || !name) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
  }

  const { data: matches, error: lookupError } = await supabaseAdmin.from('users')
    .select('user_id').ilike('email', emailMatchPattern(email)).limit(1);
  if (lookupError) return NextResponse.json({ error: 'Unable to check account availability. Please try again.' }, { status: 503 });
  if (matches?.length) return NextResponse.json({ error: DUPLICATE_ACCOUNT_MESSAGE }, { status: 409 });

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([{ email, name, surname, phone, subscription_status, subscription_plan, preferred_radius, user_type }])
    .select()
    .single();

  if (error) {
    if (isDuplicateAccountError(error)) return NextResponse.json({ error: DUPLICATE_ACCOUNT_MESSAGE }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const updates = await request.json();
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;

  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId || !/^[1-9]\d*$/.test(userId)) {
    return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 });
  }

  if (String(auth.user.internalUserId) === userId) {
    return NextResponse.json({ error: 'You cannot delete your own account from user management' }, { status: 403 });
  }

  const { data: targetUser, error: targetError } = await supabaseAdmin
    .from('users')
    .select('user_id, auth_user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (targetError) {
    return NextResponse.json({ error: 'Unable to verify the user before deletion' }, { status: 500 });
  }
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found. Refresh the user list.' }, { status: 404 });
  }

  const { data: targetRoles, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('role_id, roles(name)')
    .eq('user_id', userId);

  if (rolesError) {
    return NextResponse.json({ error: 'Unable to verify user roles before deletion' }, { status: 500 });
  }
  if (targetRoles?.some(r => isSuperAdmin((r.roles as any)?.name))) {
    return NextResponse.json({ error: 'Super Admin accounts cannot be deleted' }, { status: 403 });
  }

  // A successful PostgREST response can affect zero rows (for example under
  // RLS). Require the deleted row and confirm that it no longer exists.
  const { data: deletedUser, error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('user_id', userId)
    .select('user_id')
    .maybeSingle();
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'This user has linked records and cannot be permanently deleted. Remove or reassign those records first.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deletedUser) {
    return NextResponse.json({ error: 'No user was deleted. Check server database permissions and try again.' }, { status: 409 });
  }

  const { data: remainingUser, error: verifyError } = await supabaseAdmin
    .from('users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (verifyError || remainingUser) {
    return NextResponse.json({ error: 'User deletion could not be confirmed. Refresh and try again.' }, { status: 500 });
  }

  // Login recreates public profiles for existing Auth accounts. Remove the
  // linked identity as well, and never report full success if this step fails.
  if (targetUser.auth_user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.auth_user_id);
    if (authError && authError.status !== 404 && authError.code !== 'user_not_found') {
      console.error('User profile deleted but Auth deletion failed:', authError.message);
      return NextResponse.json({
        error: 'The user profile was removed, but sign-in account deletion failed. Account deletion is incomplete; contact support before retrying.',
        code: 'AUTH_DELETION_INCOMPLETE',
      }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, deleted_user_id: String(deletedUser.user_id) });
}
