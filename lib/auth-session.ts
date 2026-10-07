import { createHash } from 'crypto';
import { supabaseAdmin } from './server-supabase';

export function hashAccessToken(accessToken: string): string {
  return createHash('sha256').update(accessToken).digest('hex');
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

/**
 * Terminate other active sessions for a user in auth.sessions
 */
export async function terminateOtherSessions(authUserId: string, keepSessionId?: string | null) {
  try {
    await supabaseAdmin.rpc('terminate_other_sessions', {
      target_auth_user_id: authUserId,
      keep_session_id: keepSessionId || null,
    });
  } catch (rpcErr: any) {
    console.warn('[Session Control] terminate_other_sessions warning:', rpcErr?.message);
  }
}

/**
 * Registers the active access and refresh token hashes for a user.
 * Overwriting these hashes invalidates any previous session on another device.
 */
export async function setCurrentTokenHashes(
  authUserId: string,
  accessToken: string | null,
  refreshToken: string | null,
  deviceInfo?: { device_id?: string | null; device_type?: string | null; skipTerminateOtherSessions?: boolean }
) {
  const current_access_token_hash = accessToken ? hashAccessToken(accessToken) : null;
  const current_refresh_token_hash = refreshToken ? hashRefreshToken(refreshToken) : null;

  // Extract session_id from JWT payload if available
  let sessionId: string | null = null;
  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        sessionId = payload.session_id || null;
      }
    } catch (_) {}
  }

  // Invalidate any other active Supabase sessions for this user only if not explicitly skipped
  if (sessionId && !deviceInfo?.skipTerminateOtherSessions) {
    await terminateOtherSessions(authUserId, sessionId);
  }

  const updatePayload: Record<string, any> = {
    current_access_token_hash,
    current_refresh_token_hash,
  };

  if (deviceInfo?.device_type) {
    updatePayload.device_type = deviceInfo.device_type;
  }
  if (deviceInfo?.device_id) {
    updatePayload.device_id = deviceInfo.device_id;
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(updatePayload)
    .eq('auth_user_id', authUserId);

  if (error) {
    if (error.message?.includes('device_id')) {
      delete updatePayload.device_id;
      await supabaseAdmin
        .from('users')
        .update(updatePayload)
        .eq('auth_user_id', authUserId);
      return;
    }
    if (
      error.code === 'PGRST204' ||
      error.message?.includes('current_access_token_hash') ||
      error.message?.includes('current_refresh_token_hash')
    ) {
      return;
    }
    throw error;
  }
}

export async function clearCurrentTokenHashes(authUserId: string) {
  await terminateOtherSessions(authUserId, null);

  const { error } = await supabaseAdmin
    .from('users')
    .update({ current_access_token_hash: null, current_refresh_token_hash: null })
    .eq('auth_user_id', authUserId);

  if (error) {
    if (
      error.code === 'PGRST204' ||
      error.message?.includes('current_access_token_hash') ||
      error.message?.includes('current_refresh_token_hash')
    ) {
      return;
    }
    throw error;
  }
}