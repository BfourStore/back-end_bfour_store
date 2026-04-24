const { pool } = require("../config/dbConfig");

const userDAL = {
  createUser: async (user) => {
    const query = `
      INSERT INTO users (full_name, email, password_hash, phone, role)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [
      user.full_name,
      user.email,
      user.password_hash ?? null,
      user.phone ?? null,
      user.role ?? "CUSTOMER",
    ];

    const [result] = await pool.query(query, values);

    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  },

  getUserById: async (id) => {
    const [rows] = await pool.query(
        `SELECT id, full_name, email, phone, role, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
        [id]
    );
    return rows[0] || null;
  },

  getUserByEmail: async (email) => {
    const [rows] = await pool.query(
        `SELECT id, full_name, email, password_hash, phone, role, created_at, updated_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
        [email]
    );
    return rows[0] || null;
  },

  updateUser: async (id, user) => {
    const query = `
      UPDATE users
      SET full_name = ?, phone = ?, role = ?
      WHERE id = ?
    `;
    const values = [
      user.full_name,
      user.phone ?? null,
      user.role ?? "CUSTOMER",
      id,
    ];
    const [result] = await pool.query(query, values);
    return result;
  },

  updatePasswordHash: async (id, password_hash) => {
    const [result] = await pool.query(
        `UPDATE users SET password_hash = ? WHERE id = ?`,
        [password_hash, id]
    );
    return result;
  },

  deleteUser: async (id) => {
    const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
    return result;
  },

  listUsers: async () => {
    const [rows] = await pool.query(
        `SELECT id, full_name, email, phone, role, created_at, updated_at
       FROM users
       ORDER BY id DESC`
    );
    return rows;
  },
};

module.exports = userDAL;
