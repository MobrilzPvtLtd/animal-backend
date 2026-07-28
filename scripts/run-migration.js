require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const { DB_HOST: host = 'localhost', DB_PORT: port = 3306, DB_USER: user = 'root', DB_PASSWORD: password = '', DB_NAME: database = 'animal_backend' } = process.env;
  
  const conn = await mysql.createConnection({ host, port: Number(port), user, password, multipleStatements: true });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`; USE \`${database}\`;`);
  
  const sql = fs.readFileSync(path.join(__dirname, '../database/mysql_schema.sql'), 'utf8');
  await conn.query(sql);
  
  console.log('✅ Migration completed successfully!');
  await conn.end();
}

runMigration().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
