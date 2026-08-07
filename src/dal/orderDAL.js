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

  getOrderByNumber: async (orderNumber, db = pool) => {
    const [rows] = await db.query(
      `SELECT
         o.*,
         a.receiver_name AS address_receiver_name,
         a.phone AS address_phone,
         a.country AS address_country,
         a.state AS address_state,
         a.city AS address_city,
         a.neighborhood AS address_neighborhood,
         a.street AS address_street,
         a.number AS address_number,
         a.complement AS address_complement,
         a.zip_code AS address_zip_code,
         a.is_default AS address_is_default,
         a.created_at AS address_created_at
       FROM orders o
       LEFT JOIN addresses a ON a.id = o.address_id
       WHERE o.order_number = ?`,
      [orderNumber]
    );
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

  updateOrderStatusIfCurrent: async (id, status, currentStatuses, db = pool) => {
    const placeholders = currentStatuses.map(() => '?').join(', ');
    const [result] = await db.query(
      `UPDATE orders
       SET status = ?, updated_at = NOW()
       WHERE id = ?
         AND status IN (${placeholders})`,
      [status, id, ...currentStatuses]
    );
    return result;
  },

  updateOrderTotals: async (id, totals, db = pool) => {
    const [result] = await db.query(
      `UPDATE orders
       SET subtotal = ?, discount_total = ?, shipping_total = ?, total = ?, currency = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        totals.subtotal,
        totals.discount_total,
        totals.shipping_total,
        totals.total,
        totals.currency,
        id
      ]
    );
    return result;
  },

  listMyOrders: async (userId) => {
    const [rows] = await pool.query(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`, [userId]);
    return rows;
  },

  listOrderItems: async (orderId, db = pool) => {
    const [rows] = await db.query(
      `SELECT
         oi.*,
         COALESCE(
           (SELECT i.image_url
            FROM product_images i
            WHERE i.variant_id = oi.variant_id
            ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
            LIMIT 1),
           (SELECT i.image_url
            FROM product_images i
            WHERE i.product_id = p.id AND i.variant_id IS NULL
            ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
            LIMIT 1)
         ) AS image_url
       FROM order_items oi
       LEFT JOIN product_variants pv ON pv.id = oi.variant_id
       LEFT JOIN products p ON p.id = pv.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );
    return rows;
  },

  listOrderItemsForPayment: async (orderId, db = pool) => {
    const [rows] = await db.query(
      `SELECT oi.id, oi.order_id, oi.variant_id, oi.product_name, oi.variant_sku,
              oi.color, oi.size, oi.quantity, pv.price AS current_unit_price,
              p.name AS current_product_name
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );
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
