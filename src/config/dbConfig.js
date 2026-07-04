const mysql = require("mysql2/promise");

const useLocalDb = String(process.env.USE_LOCAL_DB || "").toLowerCase() === "true";

const pool = mysql.createPool({
  host: useLocalDb ? (process.env.LOCAL_DB_HOST || "127.0.0.1") : (process.env.DB_HOST || "zephyr.proxy.rlwy.net"),
  port: Number(useLocalDb ? (process.env.LOCAL_DB_PORT || 3306) : (process.env.DB_PORT || 20264)),
  user: useLocalDb ? (process.env.LOCAL_DB_USER || "root") : (process.env.DB_USER || "root"),
  password: useLocalDb
    ? (process.env.LOCAL_DB_PASSWORD || "")
    : (process.env.DB_PASSWORD || "vUgNbBpTOjgRdDEBZGJOmtyufecAOjEI"),
  database: useLocalDb ? (process.env.LOCAL_DB_NAME || "bfour_db") : (process.env.DB_NAME || "railway"),

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
