import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getUserFromRequest } from '@/lib/server-auth';
import { buildAuthProfile } from '@/lib/auth-profile';
import { supabaseAdmin } from '@/lib/server-supabase';
import { uploadAnimalImage } from '@/lib/storage-upload';

async function geocodeLocation(location: string): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!location || location.trim() === '') {
    return { latitude: null, longitude: null };
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API;
  if (!apiKey) {
    console.error('Google Maps API key is missing');
    return { latitude: null, longitude: null };
  }

  try {
    const encodedAddress = encodeURIComponent(location.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { latitude: lat, longitude: lng };
    } else {
      console.warn(`Geocoding failed for "${location}": ${data.status} - ${data.error_message || ''}`);
      return { latitude: null, longitude: null };
    }
  } catch (error) {
    console.error('Google Geocoding request error:', error);
    return { latitude: null, longitude: null };
  }
}

// GET /api/v1/auth/me - Fetch current logged-in user profile
export async function GET(request: NextRequest) {
  const token = await getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const authUser = await getUserFromRequest(request);

  if (!authUser?.id) {
    return NextResponse.json(
      {
        error: 'This account is currently active on another device. You have been logged out.',
        code: 'SESSION_TERMINATED',
      },
      { status: 401 }
    );
  }

  const authProfile = await buildAuthProfile({
    id: authUser.id,
    email: authUser.email,
    roleNames: authUser.roleNames,
  });

  return NextResponse.json({ ...authProfile });
}

function isSerializedFileObject(value: unknown): boolean {
  if (typeof value === 'string') {
    return value === '[object File]' || value === '[object Object]';
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return !('url' in value || value instanceof URL);
  }
  return false;
}

// Handler for Profile Update (PATCH, PUT, POST)
async function handleUpdateProfile(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request);

    if (!authUser?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!authUser.internalUserId) {
      return NextResponse.json({ error: 'Internal user record not found' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let updates: Record<string, unknown> = {};

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));

      const nameVal = body.name ?? body.full_name;
      if (nameVal !== undefined) updates.name = String(nameVal).trim();

      if (body.surname !== undefined) updates.surname = String(body.surname).trim();

      const usernameInput = body.user_name ?? body.username;
      if (usernameInput && typeof usernameInput === 'string' && !updates.surname) {
        const parts = usernameInput.trim().split(' ');
        if (parts.length > 1) {
          if (!updates.name) updates.name = parts[0];
          updates.surname = parts.slice(1).join(' ');
        } else if (!updates.name) {
          updates.name = parts[0];
        }
      }

      if (body.phone !== undefined) updates.phone = String(body.phone).trim();

      const locationVal = body.static_location ?? body.location ?? body.address;
      if (locationVal !== undefined) updates.static_location = String(locationVal).trim();

      if (body.preferred_radius !== undefined) updates.preferred_radius = body.preferred_radius;
      if (body.notification_preferences !== undefined) updates.notification_preferences = body.notification_preferences;

      const imgUrlVal = body.profile_image ?? body.profile_image_url ?? body.avatar;
      if (imgUrlVal !== undefined && !isSerializedFileObject(imgUrlVal)) {
        updates.profile_image_url = String(imgUrlVal).trim();
      }
    } else {
      // Multipart/form-data or urlencoded form
      const formData = await request.formData();

      // Check image file fields (profile_image, profile_image_url, avatar, photo, image, file)
      const imageField =
        formData.get('profile_image') ??
        formData.get('profile_image_url') ??
        formData.get('avatar') ??
        formData.get('photo') ??
        formData.get('image') ??
        formData.get('file');

      if (imageField instanceof File && imageField.size > 0) {
        const { url } = await uploadAnimalImage(imageField, 'avatars');
        updates.profile_image_url = url;
      } else if (typeof imageField === 'string' && imageField.trim() && imageField !== '[object File]') {
        updates.profile_image_url = imageField.trim();
      }

      const nameVal = formData.get('name') ?? formData.get('full_name');
      if (nameVal !== null) updates.name = nameVal.toString().trim();

      const surnameVal = formData.get('surname');
      if (surnameVal !== null) updates.surname = surnameVal.toString().trim();

      const usernameVal = formData.get('user_name') ?? formData.get('username');
      if (usernameVal !== null && !updates.surname) {
        const parts = usernameVal.toString().trim().split(' ');
        if (parts.length > 1) {
          if (!updates.name) updates.name = parts[0];
          updates.surname = parts.slice(1).join(' ');
        } else if (!updates.name) {
          updates.name = parts[0];
        }
      }

      const phoneVal = formData.get('phone');
      if (phoneVal !== null) updates.phone = phoneVal.toString().trim();

      const locationVal = formData.get('static_location') ?? formData.get('location') ?? formData.get('address');
      if (locationVal !== null) updates.static_location = locationVal.toString().trim();

      const radiusVal = formData.get('preferred_radius');
      if (radiusVal !== null) updates.preferred_radius = radiusVal.toString().trim();

      const prefsVal = formData.get('notification_preferences');
      if (prefsVal !== null) updates.notification_preferences = prefsVal.toString().trim();
    }

    // Crucial: user_name is a GENERATED ALWAYS column in PostgreSQL (name || ' ' || surname).
    // We MUST NOT pass user_name in update payload to prevent PostgreSQL 500 error!
    delete updates.user_name;
    delete updates.username;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error:
            'No valid fields provided. Supported fields: name, full_name, user_name, username, surname, phone, profile_image, profile_image_url, avatar, location, address, static_location',
        },
        { status: 400 }
      );
    }

    // Geocode location if updated
    if (updates.static_location) {
      const { latitude, longitude } = await geocodeLocation(updates.static_location as string);
      updates.latitude = latitude;
      updates.longitude = longitude;
    }

    // Update public.users DB table
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('user_id', authUser.internalUserId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update Supabase Auth User Metadata for consistency
    try {
      const userMetaUpdates: Record<string, unknown> = {};
      if (updates.name) userMetaUpdates.name = updates.name;
      if (updates.surname) userMetaUpdates.surname = updates.surname;
      if (updatedUser?.user_name) userMetaUpdates.user_name = updatedUser.user_name;
      if (updates.profile_image_url) userMetaUpdates.profile_image_url = updates.profile_image_url;

      if (Object.keys(userMetaUpdates).length > 0) {
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          user_metadata: userMetaUpdates,
        });
      }
    } catch (metaErr) {
      console.warn('Failed to sync auth user metadata:', metaErr);
    }

    const authProfile = await buildAuthProfile({
      id: authUser.id,
      email: authUser.email,
      roleNames: authUser.roleNames,
    });

    return NextResponse.json({ ...authProfile, user: updatedUser });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: error?.message || 'Profile update failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  return handleUpdateProfile(request);
}

export async function PUT(request: NextRequest) {
  return handleUpdateProfile(request);
}

export async function POST(request: NextRequest) {
  return handleUpdateProfile(request);
}
