const { pool } = require('../config/dbConfig');

const orderDAL = {
  createOrder: async (o, db = pool) => {
    const [result] = await db.query(
      `INSERT INTO orders
       (user_id, address_id, order_number, status, currency, subtotal, discount_total, shipping_total, total, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        o.user_id || null,
        o.address_id,
        o.order_number,
        o.status || 'PENDING',
        o.currency,
        o.subtotal,
        o.discount_total || 0,
        o.shipping_total || 0,
        o.total,
        o.notes || null
      ]
    );
    return result;
  },

  addOrderItem: async (it, db = pool) => {
    const [result] = await db.query(
      `INSERT INTO order_items
       (order_id, variant_id, product_name, variant_sku, color, size, quantity, unit_price, line_total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        it.order_id,
        it.variant_id,
        it.product_name,
        it.variant_sku,
        it.color || null,
        it.size || null,
        it.quantity,
        it.unit_price,
        it.line_total
      ]
    );
    return result;
  },

  getOrderById: async (id, db = pool) => {
    const [rows] = await db.query(`SELECT * FROM orders WHERE id = ?`, [id]);
    return rows[0] || null;
  },

  getOrderByIdForUpdate: async (id, db = pool) => {
    const [rows] = await db.query(`SELECT * FROM orders WHERE id = ? FOR UPDATE`, [id]);
    return rows[0] || null;
  },

  updateOrderStatus: async (id, status, db = pool) => {
    const [result] = await db.query(
      `UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );
    return result;
  },

  listMyOrders: async (userId) => {
    const [rows] = await pool.query(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`, [userId]);
    return rows;
  },

  listOrderItems: async (orderId, db = pool) => {
    const [rows] = await db.query(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`, [orderId]);
    return rows;
  },

  getVariantSnapshot: async (variantId, db = pool) => {
    const [rows] = await db.query(
      `SELECT pv.id as variant_id, pv.sku, pv.color, pv.size, pv.price,
              p.name as product_name
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ?`,
      [variantId]
    );
    return rows[0] || null;
  },

    getCartItemsByUser: async (userId, db = pool) => {
        const [rows] = await db.query(`
      SELECT ci.variant_id, ci.quantity
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE c.user_id = ?
    `, [userId]);

        return rows;
    },

    clearCart: async (userId, db = pool) => {
        await db.query(`
      DELETE ci FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE c.user_id = ?
    `, [userId]);
    }
};

module.exports = orderDAL;
