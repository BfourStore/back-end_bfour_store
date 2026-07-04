const { pool } = require('../config/dbConfig');

const paymentDAL = {
  create: async (p, db = pool) => {
    const [result] = await db.query(
      `INSERT INTO payments
       (order_id, provider, status, amount, currency, stripe_payment_intent_id, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        p.order_id,
        p.provider,
        p.status || 'PENDING',
        p.amount,
        p.currency,
        p.stripe_payment_intent_id || null,
        p.paid_at || null
      ]
    );
    return result;
  },

  getById: async (id, db = pool) => {
    const [rows] = await db.query(`SELECT * FROM payments WHERE id = ?`, [id]);
    return rows[0] || null;
  },

  getLatestByOrderId: async (orderId, db = pool) => {
    const [rows] = await db.query(
      `SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [orderId]
    );
    return rows[0] || null;
  },

  updateStripeSessionCreated: async ({ id, amount, currency }, db = pool) => {
    const [result] = await db.query(
      `UPDATE payments
       SET status = 'PENDING',
           amount = ?,
           currency = ?,
           paid_at = NULL
       WHERE id = ?`,
      [amount, currency, id]
    );
    return result;
  },

  markSucceededByOrderId: async ({ order_id, stripe_payment_intent_id }, db = pool) => {
    const [result] = await db.query(
      `UPDATE payments
       SET status = 'SUCCEEDED',
           stripe_payment_intent_id = ?,
           paid_at = NOW()
       WHERE order_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [stripe_payment_intent_id || null, order_id]
    );
    return result;
  }
};

module.exports = paymentDAL;
