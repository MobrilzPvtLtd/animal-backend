const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Manually parse .env file if env vars not set
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    });
  }
}

async function seedSuperAdmin() {
  loadEnv();

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'animal_backend';

  const adminEmail = process.env.ADMIN_EMAIL || 'superadmin@animal.com';
  const plainPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const adminName = 'Super';
  const adminSurname = 'Admin';

  console.log(`🔌 Connecting to MySQL (${host}:${port}/${database})...`);

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    console.log('Connected to MySQL.');

    // Hash the password using bcrypt with salt rounds = 10
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    console.log('Password hashed successfully with bcrypt.');

    // 1. Get super_admin role ID
    const [roles] = await connection.execute(
      "SELECT role_id FROM roles WHERE name = 'super_admin' LIMIT 1"
    );

    let roleId = 1;
    if (roles.length > 0) {
      roleId = roles[0].role_id;
    } else {
      console.log('super_admin role not found in roles table. Creating it...');
      const [roleRes] = await connection.execute(
        "INSERT INTO roles (name, description, is_system_role) VALUES ('super_admin', 'Super Administrator with full access', TRUE)"
      );
      roleId = roleRes.insertId;
    }

    // 2. Check if user already exists
    const [users] = await connection.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [adminEmail]
    );

    let userId;
    if (users.length > 0) {
      userId = users[0].user_id;
      console.log(`User with email "${adminEmail}" already exists (User ID: ${userId}).`);
      // Update hashed password and active status
      await connection.execute(
        'UPDATE users SET password = ?, is_active = TRUE, is_verified = TRUE WHERE user_id = ?',
        [hashedPassword, userId]
      );
      console.log('User hashed password and active status updated.');
    } else {
      // Insert new super admin user with hashed password
      const [userRes] = await connection.execute(
        'INSERT INTO users (email, name, surname, password, phone, is_verified, is_active) VALUES (?, ?, ?, ?, ?, TRUE, TRUE)',
        [adminEmail, adminName, adminSurname, hashedPassword, '1234567890']
      );
      userId = userRes.insertId;
      console.log(`Super Admin user created with User ID: ${userId}`);
    }

    // 3. Assign super_admin role in user_roles
    const [userRoles] = await connection.execute(
      'SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );

    if (userRoles.length === 0) {
      await connection.execute(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [userId, roleId]
      );
      console.log(`Granted super_admin role (Role ID: ${roleId}) to User ID: ${userId}`);
    } else {
      console.log('User already has super_admin role assigned.');
    }

    console.log('\n=============================================');
    console.log('Super Admin Seed Completed Successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Plain Password: ${plainPassword}`);
    console.log(`Hashed Password: ${hashedPassword}`);
    console.log('=============================================\n');

    await connection.end();
  } catch (error) {
    console.error('Error during seeding:', error.message);
    process.exit(1);
  }
}

seedSuperAdmin();
