import { supabaseAdmin } from '@/lib/server-supabase';

export const PUBLIC_SIGNUP_ROLE_NAMES = ['Guest', 'Subscriber', 'Provider','Admin','Approver','Manager','Owner'] as const;

export type PermissionRecord = {
  permission_id: number;
  name: string;
  description: string | null;
  resource: string;
  action: string;
};

export type RoleRecord = {
  role_id: number;
  name: string;
  description: string | null;
  is_system_role: boolean | null;
};

export type AuthProfileRole = {
  role_id: number;
  roles: RoleRecord | null;
};

export type AuthProfile = {
  user_id: string | number;
  user_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  profile_image_url: string | null;
  is_verified: boolean;
  subscription_status: string | null;
  subscription_plan?: string | null;
  subscription_expires_at?: string | null;
  is_subscribed?: boolean;
  user_type: string | null;
  created_at: string | null;
  auth_user_id: string;
  user_roles: AuthProfileRole[];
  permissions: PermissionRecord[];
};

export type AuthUserInput = {
  id: string;
  email: string | null;
  roleNames?: string[];
};

function dedupeByKey<T>(items: T[], keySelector: (item: T) => string | number) {
  const seen = new Set<string | number>();
  return items.filter((item) => {
    const key = keySelector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadInternalUser(authUser: AuthUserInput) {
  const selectQuery = `
    user_id,
    user_name,
    name,
    surname,
    email,
    phone,
    static_location,
    latitude,
    longitude,
    profile_image_url:profile_image_url,
    subscription_status,
    subscription_plan,
    subscription_expires_at,
    user_type,
    created_at,
    auth_user_id
  `;

  let { data, error } = await supabaseAdmin
    .from('users')
    .select(selectQuery)
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!data && authUser.email) {
    const fallback = await supabaseAdmin
      .from('users')
      .select(selectQuery)
      .eq('email', authUser.email)
      .maybeSingle();

    data = fallback.data;
    error = fallback.error;

    if (data && !data.auth_user_id) {
      await supabaseAdmin
        .from('users')
        .update({ auth_user_id: authUser.id })
        .eq('user_id', data.user_id);
    }
  }

  if (error) {
    throw error;
  }

  return data;
}

async function loadRoles(profileRecord: any, authUser: AuthUserInput) {
  const normalizedUserId = Number(profileRecord.user_id);
  const canQueryUserRoles = Number.isFinite(normalizedUserId) && String(normalizedUserId) === String(profileRecord.user_id);

  let normalizedRoles: AuthProfileRole[] = [];

  if (canQueryUserRoles) {
    const profileRoles = await supabaseAdmin
      .from('user_roles')
      .select(
        `
          role_id,
          roles (
            role_id,
            name,
            description,
            is_system_role
          )
        `
      )
      .eq('user_id', normalizedUserId);

    if (profileRoles.error) {
      throw profileRoles.error;
    }

    normalizedRoles = (profileRoles.data || []).map((role: any) => ({
      role_id: role.role_id,
      roles: Array.isArray(role.roles) ? role.roles[0] : role.roles,
    }));
  }

  if (normalizedRoles.length === 0 && profileRecord.user_type) {
    const { data: fallbackRole } = await supabaseAdmin
      .from('roles')
      .select('role_id, name, description, is_system_role')
      .eq('name', profileRecord.user_type)
      .maybeSingle();

    if (fallbackRole) {
      normalizedRoles = [{ role_id: fallbackRole.role_id, roles: fallbackRole }];
    }
  }

  if (normalizedRoles.length === 0 && authUser.roleNames?.length) {
    const { data: fallbackRoles, error: fallbackError } = await supabaseAdmin
      .from('roles')
      .select('role_id, name, description, is_system_role')
      .in('name', authUser.roleNames);

    if (fallbackError) {
      throw fallbackError;
    }

    normalizedRoles = (fallbackRoles || []).map((role: any) => ({
      role_id: role.role_id,
      roles: role,
    }));
  }

  return normalizedRoles;
}

async function loadPermissions(roleIds: number[]) {
  if (!roleIds.length) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('role_permissions')
    .select(
      `
        role_id,
        permissions (
          permission_id,
          name,
          description,
          resource,
          action
        )
      `
    )
    .in('role_id', roleIds);

  if (error) {
    throw error;
  }

  const permissions = (data || [])
    .flatMap((row: any) => (Array.isArray(row.permissions) ? row.permissions : [row.permissions]))
    .filter(Boolean) as PermissionRecord[];

  return dedupeByKey(permissions, (permission) => permission.permission_id);
}

async function loadSubscriptionPlanDetails(planCode: string | null | undefined) {
  if (!planCode || !planCode.trim()) return null;

  try {
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('plan_code', planCode.trim())
      .maybeSingle();

    return data || null;
  } catch (err) {
    console.warn('Failed to fetch plan details for code:', planCode, err);
    return null;
  }
}

export async function buildAuthProfile(authUser: AuthUserInput) {
  const profileRecord = await loadInternalUser(authUser);
  const fallbackDisplayName = authUser.email?.split('@')[0] || 'User';

  const defaults: AuthProfile = {
    user_id: authUser.id,
    user_name: fallbackDisplayName,
    name: fallbackDisplayName,
    email: authUser.email,
    phone: null,
    profile_image_url: null,
    is_verified: true,
    subscription_status: null,
    user_type: authUser.roleNames?.[0] || null,
    created_at: null,
    auth_user_id: authUser.id,
    user_roles: [],
    permissions: [],
  };

  const baseProfile = {
    ...defaults,
    ...(profileRecord || {}),
  } as AuthProfile;

  const userRoles = await loadRoles(baseProfile, authUser);
  const roleIds = userRoles.map((role) => role.role_id);
  const permissions = await loadPermissions(roleIds);

  const rawStatus = String(baseProfile.subscription_status || '').toLowerCase();
  const expiresAtStr = baseProfile.subscription_expires_at;
  const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
  const now = new Date();

  const isSubscribed = Boolean(
    (rawStatus === 'active' || rawStatus === 'subscribed' || rawStatus === 'paid' || rawStatus === 'true') &&
    (!expiresAt || expiresAt > now)
  );

  const planDetails = await loadSubscriptionPlanDetails(baseProfile.subscription_plan);

  return {
    profile: {
      ...baseProfile,
      is_subscribed: isSubscribed,
      subscription_plan: baseProfile.subscription_plan || null,
      subscription_expires_at: baseProfile.subscription_expires_at || null,
      subscription_plan_details: planDetails || null,
      user_roles: userRoles,
      permissions,
    },
    is_subscribed: isSubscribed,
    roleIds,
    roleNames: userRoles.map((role) => role.roles?.name).filter(Boolean) as string[],
    permissions,
    permissionNames: permissions.map((permission) => permission.name),
  };
}
