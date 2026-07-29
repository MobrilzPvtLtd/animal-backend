const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Load environment variables from .env file manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) {
        process.env[key.trim()] = val;
      }
    }
  });
}

async function runMigration() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'animal_backend';

  console.log(`🔌 Connecting to MySQL database at ${host}:${port}...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  console.log(`📦 Creating database \`${database}\` if not exists...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE \`${database}\`;`);

  const schemaPath = path.join(__dirname, '../database/mysql_schema.sql');
  console.log(`📜 Reading MySQL schema from database/mysql_schema.sql...`);
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log(`⚡ Executing MySQL schema migration...`);
  await conn.query(sql);

  console.log('✅ Schema migration completed successfully!');

  // Seed Super Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'superadmin@animal.com';
  const adminPass = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);

  console.log(`👤 Seeding default Super Admin (${adminEmail})...`);
  await conn.execute(
    `INSERT INTO users (email, name, surname, password, phone, is_verified, is_active)
     VALUES (?, 'Super', 'Admin', ?, '1234567890', 1, 1)
     ON DUPLICATE KEY UPDATE password = ?, is_active = 1`,
    [adminEmail, adminPass, adminPass]
  );

  const [[u]] = await conn.execute('SELECT user_id FROM users WHERE email = ?', [adminEmail]);
  if (u && u.user_id) {
    await conn.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, 1)', [u.user_id]);
  }

  // Count tables
  const [tables] = await conn.execute('SHOW TABLES');
  console.log(`🎉 Migration verified! Total tables in \`${database}\`: ${tables.length}`);

  await conn.end();
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
