import mysql from 'mysql2/promise';

// Create MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'animal_backend',
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000, // 5 seconds fast timeout
  queueLimit: 0,
});

export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export default pool;
