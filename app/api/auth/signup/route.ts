import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";

interface UserRow {
  user_id: number;
}

interface RoleRow {
  role_id: number;
}

interface InsertResult {
  insertId: number;
}

// Auto-ensure columns exist in users table (prevents 'Unknown column' MySQL errors on existing live databases)
let isTableChecked = false;
async function ensureUserColumns() {
  if (isTableChecked) return;
  try {
    await query("ALTER TABLE `users` ADD COLUMN `username` VARCHAR(255) NULL AFTER `email`").catch(() => { });
    await query("ALTER TABLE `users` ADD COLUMN `location` VARCHAR(255) NULL AFTER `phone`").catch(() => { });
    isTableChecked = true;
  } catch (err) {
    isTableChecked = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUserColumns();

    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, any> = {};

    // Handle FormData & JSON
    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
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
      name = "",
      username = "",
      location = "",
      imagePath = "",
    } = body;

    // 1. Mandatory Validation
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    // 2. Check existing user
    const existingUsers = await query<UserRow[]>(
      "SELECT user_id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Insert user
    const result = (await query(
      `INSERT INTO users (email, username, name, password, location, profile_image_url, device_type, is_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'Web', 1, 1)`,
      [email, username, name, hashedPassword, location, imagePath]
    )) as InsertResult;

    // 5. Get default role
    const roles = await query<RoleRow[]>(
      "SELECT role_id FROM roles WHERE name = 'user' LIMIT 1"
    );
    const roleId = roles && roles.length ? roles[0].role_id : 7;

    // 6. Assign role
    await query("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [
      result.insertId,
      roleId,
    ]);

    const userPayload = {
      user_id: result.insertId,
      email,
      username: username || email,
      name,
      location,
      imagePath,
      roles: [roleId],
    };

    const response = NextResponse.json(
      { message: "Registration successful", user: userPayload },
      { status: 201 }
    );

    response.cookies.set("user_session", JSON.stringify(userPayload), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error("Signup API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}