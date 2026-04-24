const { pool } = require('../config/dbConfig');

const paymentDAL = {
  create: async (p) => {
    const [result] = await pool.query(
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

  getById: async (id) => {
    const [rows] = await pool.query(`SELECT * FROM payments WHERE id = ?`, [id]);
    return rows[0] || null;
  }
};

module.exports = paymentDAL;
