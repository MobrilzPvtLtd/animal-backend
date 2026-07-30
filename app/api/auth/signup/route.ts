import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateTokens } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, any> = {};

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        if (value instanceof File) {
          body[key] = value.name;
        } else {
          body[key] = value;
        }
      });
    } else {
      body = await request.json().catch(() => ({}));
    }

    const {
      email,
      password,
      confirmPassword,
      name = '',
      username = '',
      location = '',
      imagePath = '',
    } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // Check existing user in Supabase (PostgreSQL)
    const { data: existingUser } = await supabaseServer
      .from('users')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into Supabase (PostgreSQL)
    const { data: newUser, error: insertError } = await supabaseServer
      .from('users')
      .insert({
        email,
        username: username || email,
        name,
        password: hashedPassword,
        location,
        profile_image_url: imagePath,
        device_type: 'Web',
        is_verified: true,
        is_active: true,
      })
      .select('user_id')
      .single();

    if (insertError || !newUser) {
      console.error('Error creating user:', insertError);
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
    }

    const userId = newUser.user_id;

    // Default role query
    const { data: defaultRole } = await supabaseServer
      .from('roles')
      .select('role_id')
      .eq('name', 'user')
      .maybeSingle();

    const roleId = defaultRole?.role_id ?? 7;

    // Assign user role
    await supabaseServer.from('user_roles').insert({
      user_id: userId,
      role_id: roleId,
    });

    const origin = request.nextUrl.origin;
    let fullImagePath = imagePath;
    if (imagePath && !imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
      const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
      fullImagePath = `${origin}${cleanPath}`;
    }

    // Generate JWT Access Token & Refresh Token
    const tokens = generateTokens({
      user_id: userId,
      email: email,
      roles: [roleId],
    });

    const userPayload = {
      user_id: userId,
      email,
      username: username || email,
      name,
      location,
      imagePath: fullImagePath,
      roles: [roleId],
    };

    // Response body (Clean user data, tokens sent in Headers only)
    const response = NextResponse.json(
      {
        message: 'Registration successful',
        user: userPayload,
      },
      { status: 201 }
    );

    // Set Tokens in HTTP Response Headers ONLY
    response.headers.set('Authorization', `Bearer ${tokens.token}`);
    response.headers.set('access-token', tokens.token);
    response.headers.set('refresh-token', tokens.refresh_token);

    // Set Auth Cookies
    response.cookies.set('user_session', JSON.stringify(userPayload), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expires_in,
    });
    response.cookies.set('token', tokens.token, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expires_in,
    });

    return response;
  } catch (error: any) {
    console.error('Signup API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}