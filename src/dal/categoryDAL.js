const { pool } = require('../config/dbConfig');

const categoryDAL = {
  create: async (c) => {
    const [result] = await pool.query(
      `INSERT INTO categories (name, slug, parent_id, created_at) VALUES (?, ?, ?, NOW())`,
      [c.name, c.slug, c.parent_id || null]
    );
    return result;
  },

  getById: async (id) => {
    const [rows] = await pool.query(`SELECT * FROM categories WHERE id = ?`, [id]);
    return rows[0] || null;
  },

  getBySlug: async (slug) => {
    const [rows] = await pool.query(`SELECT * FROM categories WHERE slug = ?`, [slug]);
    return rows[0] || null;
  },

  list: async () => {
    const [rows] = await pool.query(`SELECT * FROM categories ORDER BY id DESC`);
    return rows;
  },

  update: async (id, c) => {
    const [result] = await pool.query(
      `UPDATE categories SET name=?, slug=?, parent_id=? WHERE id=?`,
      [c.name, c.slug, c.parent_id || null, id]
    );
    return result;
  },

  delete: async (id) => {
    const [result] = await pool.query(`DELETE FROM categories WHERE id = ?`, [id]);
    return result;
  }
};

module.exports = categoryDAL;
