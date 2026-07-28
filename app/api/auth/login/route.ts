import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

    // 2. Validate password (bcrypt compare or direct comparison fallback)
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

    // 4. Construct user response object
    const userResponse = {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      phone: user.phone,
      profile_image_url: user.profile_image_url,
      roles: roles,
    };

    // Return success response
    const response = NextResponse.json({
      message: 'Login successful',
      user: userResponse,
    });

    // Set auth cookie
    response.cookies.set('user_session', JSON.stringify(userResponse), {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
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
