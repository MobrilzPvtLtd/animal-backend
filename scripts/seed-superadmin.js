require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seedSuperAdmin() {
  const { DB_HOST: host = 'localhost', DB_PORT: port = 3306, DB_USER: user = 'root', DB_PASSWORD: password = '', DB_NAME: database = 'animal_backend' } = process.env;
  
  const conn = await mysql.createConnection({ host, port: Number(port), user, password, database });
  const email = process.env.ADMIN_EMAIL || 'superadmin@animal.com';
  const pass = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);

  await conn.execute(
    `INSERT INTO users (email, name, surname, password, phone, is_verified, is_active)
     VALUES (?, 'Super', 'Admin', ?, '1234567890', 1, 1)
     ON DUPLICATE KEY UPDATE password = ?, is_active = 1`,
    [email, pass, pass]
  );

  const [[u]] = await conn.execute('SELECT user_id FROM users WHERE email = ?', [email]);
  await conn.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, 1)', [u.user_id]);

  console.log(`✅ Super Admin seeded successfully (${email})!`);
  await conn.end();
}

seedSuperAdmin().catch(err => { console.error('Seeding failed:', err.message); process.exit(1); });
