const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bfour_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",
});

async function testDbConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log("✅ MySQL conectado com sucesso!");
  } finally {
    conn.release();
  }
}

module.exports = { pool, testDbConnection };
