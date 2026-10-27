import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateTokens } from '@/lib/jwt';
import bcrypt from 'bcryptjs';
import { normalizeEmail, isDuplicateAccountError, DUPLICATE_ACCOUNT_MESSAGE } from '@/lib/account-identity';

interface UserRow {
  user_id: number;
}

interface RoleRow {
  role_id: number;
}

interface InsertResult {
  insertId: number;
}

// Auto-ensure columns exist in users table
let isTableChecked = false;
async function ensureUserColumns() {
  if (isTableChecked) return;
  try {
    await query('ALTER TABLE `users` ADD COLUMN `username` VARCHAR(255) NULL AFTER `email`').catch(() => { });
    await query('ALTER TABLE `users` ADD COLUMN `location` VARCHAR(255) NULL AFTER `phone`').catch(() => { });
    isTableChecked = true;
  } catch (err) {
    isTableChecked = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUserColumns();

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
      email: rawEmail,
      password,
      confirmPassword,
      name = '',
      username = '',
      location = '',
      imagePath = '',
    } = body;
    const email = normalizeEmail(rawEmail);

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

    // Check existing user
    const existingUsers = await query<UserRow[]>(
      'SELECT user_id FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [email]
    );

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ error: DUPLICATE_ACCOUNT_MESSAGE }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = (await query(
      `INSERT INTO users (email, username, name, password, location, profile_image_url, device_type, is_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'Web', 1, 1)`,
      [email, username, name, hashedPassword, location, imagePath]
    )) as InsertResult;

    // Default role
    const roles = await query<RoleRow[]>("SELECT role_id FROM roles WHERE name = 'user' LIMIT 1");
    const roleId = roles && roles.length ? roles[0].role_id : 7;

    // Assign role
    await query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [result.insertId, roleId]);

    const origin = request.nextUrl.origin;
    let fullImagePath = imagePath;
    if (imagePath && !imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
      const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
      fullImagePath = `${origin}${cleanPath}`;
    }

    // Generate JWT Access Token & Refresh Token
    const tokens = generateTokens({
      user_id: result.insertId,
      email: email,
      roles: [roleId],
    });

    const userPayload = {
      user_id: result.insertId,
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
    if (isDuplicateAccountError(error)) return NextResponse.json({ error: DUPLICATE_ACCOUNT_MESSAGE }, { status: 409 });
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
