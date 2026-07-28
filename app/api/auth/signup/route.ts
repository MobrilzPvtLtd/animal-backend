import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password,
      confirmPassword,
      name = '',
      username = '',
      location = '',
      imagePath = '',
    } = await request.json();

    // 1. Mandatory Field Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 2. Confirm Password Check (if provided)
    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // 3. Email Existence Check
    const existingUsers = await query<any[]>(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // 4. Hash Password with Bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Insert New User into MySQL Database
    const result: any = await query(
      `INSERT INTO users (email, username, name, password, location, profile_image_url, device_type, is_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'Web', TRUE, TRUE)`,
      [email, username, name, hashedPassword, location, imagePath]
    );

    const newUserId = result.insertId;

    // 6. Assign Default 'user' Role
    const roles = await query<any[]>("SELECT role_id FROM roles WHERE name = 'user' LIMIT 1");
    const roleId = roles.length > 0 ? roles[0].role_id : 7;

    await query(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [newUserId, roleId]
    );

    const userPayload = {
      user_id: newUserId,
      email: email,
      username: username || email,
      name: name,
      location: location,
      imagePath: imagePath,
      roles: [roleId],
    };

    const response = NextResponse.json(
      {
        message: 'Registration successful',
        user: userPayload,
      },
      { status: 201 }
    );

    // Set auth session cookie
    response.cookies.set('user_session', JSON.stringify(userPayload), {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
