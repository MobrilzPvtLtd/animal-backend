import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateTokens } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 1. Fetch user from MySQL
    const users = await query<any[]>(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE AND is_deleted = FALSE LIMIT 1',
      [email]
    );

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users[0];

    // 2. Validate password
    let isPasswordValid = false;
    if (user.password) {
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        isPasswordValid = user.password === password;
      }
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 3. Fetch user roles
    const userRoles = await query<any[]>(
      'SELECT role_id FROM user_roles WHERE user_id = ?',
      [user.user_id]
    );
    const roles = userRoles.map((r) => r.role_id);

    // 4. Generate JWT Access Token & Refresh Token
    const tokens = generateTokens({
      user_id: user.user_id,
      email: user.email,
      roles: roles,
    });

    const userPayload = {
      user_id: user.user_id,
      email: user.email,
      username: user.username || user.email,
      name: user.name,
      surname: user.surname,
      phone: user.phone,
      location: user.location,
      profile_image_url: user.profile_image_url,
      roles: roles,
    };

    // 5. Response body (Clean user data, tokens sent in Headers only)
    const response = NextResponse.json({
      message: 'Login successful',
      user: userPayload,
    });

    // 6. Set Tokens in HTTP Response Headers ONLY
    response.headers.set('Authorization', `Bearer ${tokens.token}`);
    response.headers.set('access-token', tokens.token);
    response.headers.set('refresh-token', tokens.refresh_token);

    // 7. Set Auth Cookies
    response.cookies.set('user_session', JSON.stringify(userPayload), {
      httpOnly: false,
      path: '/',
      maxAge: tokens.expires_in,
    });
    response.cookies.set('token', tokens.token, {
      httpOnly: false,
      path: '/',
      maxAge: tokens.expires_in,
    });

    return response;
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
