const { pool } = require('../config/dbConfig');

const cartDAL = {
  getActiveCartByUser: async (userId) => {
    const [rows] = await pool.query(`SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`, [userId]);
    return rows[0] || null;
  },

  createCart: async (userId) => {
    const [result] = await pool.query(
      `INSERT INTO carts (user_id, status, created_at, updated_at) VALUES (?, 'ACTIVE', NOW(), NOW())`,
      [userId]
    );
    return result;
  },

  addItem: async (item) => {
    const [result] = await pool.query(
      `INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [item.cart_id, item.variant_id, item.quantity, item.unit_price]
    );
    return result;
  },

  updateItemQty: async (id, quantity) => {
    const [result] = await pool.query(`UPDATE cart_items SET quantity = ? WHERE id = ?`, [quantity, id]);
    return result;
  },

  deleteItem: async (id) => {
    const [result] = await pool.query(`DELETE FROM cart_items WHERE id = ?`, [id]);
    return result;
  },

  listItems: async (cartId) => {
    const [rows] = await pool.query(`SELECT * FROM cart_items WHERE cart_id = ? ORDER BY id DESC`, [cartId]);
    return rows;
  },

  getItemByCartAndVariant: async (cartId, variantId) => {
    const [rows] = await pool.query(
      `SELECT * FROM cart_items WHERE cart_id = ? AND variant_id = ? ORDER BY id DESC LIMIT 1`,
      [cartId, variantId]
    );
    return rows[0] || null;
  },

  listItemsDetailedForTemplate: async (cartId) => {
    const [rows] = await pool.query(
      `SELECT
          ci.id                   AS cart_item_id,
          ci.variant_id           AS variant_id,
          ci.quantity             AS quantity,
          ci.unit_price           AS unit_price,
          v.sku                   AS sku,
          v.color                 AS color,
          v.size                  AS size,
          v.price                 AS current_price,
          p.name                  AS product_name,
          p.description           AS description,
          c.name                  AS category_name,
          pc.name                 AS parent_category_name,
        COALESCE(
  (SELECT i.image_url
   FROM product_images i
   WHERE i.variant_id = v.id
   ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
   LIMIT 1),
  (SELECT i.image_url
   FROM product_images i
   WHERE i.product_id = p.id AND i.variant_id IS NULL
   ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
   LIMIT 1)
) AS image_url
        FROM cart_items ci
        JOIN product_variants v ON v.id = ci.variant_id
        JOIN products p ON p.id = v.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN categories pc ON pc.id = c.parent_id
        WHERE ci.cart_id = ?
        ORDER BY ci.id DESC`,
      [cartId]
    );
    return rows;
  },

  touchCart: async (cartId) => {
    await pool.query(`UPDATE carts SET updated_at = NOW() WHERE id = ?`, [cartId]);
  },

  getVariantPrice: async (variantId) => {
    const [rows] = await pool.query(`SELECT price FROM product_variants WHERE id = ? AND is_active = 1`, [variantId]);
    return rows[0] || null;
  }
};

module.exports = cartDAL;
