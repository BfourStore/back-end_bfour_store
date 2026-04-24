const { pool } = require('../config/dbConfig');

const addressDAL = {
  create: async (address) => {
    const query = `
      INSERT INTO addresses
      (user_id, receiver_name, phone, country, state, city, neighborhood, street, number, complement, zip_code, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const values = [
      address.user_id,
      address.receiver_name,
      address.phone || null,
      address.country,
      address.state,
      address.city,
      address.neighborhood || null,
      address.street,
      address.number || null,
      address.complement || null,
      address.zip_code,
      address.is_default ? 1 : 0
    ];
    const [result] = await pool.query(query, values);
    return result;
  },

  listByUser: async (userId) => {
    const [rows] = await pool.query(`SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC`, [userId]);
    return rows;
  },

  getById: async (id) => {
    const [rows] = await pool.query(`SELECT * FROM addresses WHERE id = ?`, [id]);
    return rows[0] || null;
  },

  update: async (id, address) => {
    const query = `
      UPDATE addresses
      SET receiver_name=?, phone=?, country=?, state=?, city=?, neighborhood=?, street=?, number=?, complement=?, zip_code=?, is_default=?
      WHERE id=?
    `;
    const values = [
      address.receiver_name,
      address.phone || null,
      address.country,
      address.state,
      address.city,
      address.neighborhood || null,
      address.street,
      address.number || null,
      address.complement || null,
      address.zip_code,
      address.is_default ? 1 : 0,
      id
    ];
    const [result] = await pool.query(query, values);
    return result;
  },

  delete: async (id) => {
    const [result] = await pool.query(`DELETE FROM addresses WHERE id = ?`, [id]);
    return result;
  }
};

module.exports = addressDAL;
