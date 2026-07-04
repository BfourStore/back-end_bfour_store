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

  getPaymentByOrderId: async (orderId, db = pool) => {
    const [rows] = await db.query(
      `SELECT * FROM payments
       WHERE order_id = ? AND provider = 'STRIPE'
       ORDER BY id DESC
       LIMIT 1`,
      [orderId]
    );
    return rows[0] || null;
  },

  getPaymentByStripePaymentIntentId: async (stripePaymentIntentId, db = pool) => {
    const [rows] = await db.query(
      `SELECT * FROM payments
       WHERE stripe_payment_intent_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [stripePaymentIntentId]
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

  updatePaymentStatus: async ({ id, status, stripe_payment_intent_id, paid_at }, db = pool) => {
    const [result] = await db.query(
      `UPDATE payments
       SET status = ?,
           stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           paid_at = ?
       WHERE id = ?`,
      [status, stripe_payment_intent_id || null, paid_at || null, id]
    );
    return result;
  },

  upsertStripePaymentForOrder: async (p, db = pool) => {
    const payment = await paymentDAL.getPaymentByOrderId(p.order_id, db);

    if (payment) {
      await db.query(
        `UPDATE payments
         SET amount = COALESCE(?, amount),
             currency = COALESCE(?, currency),
             stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id)
         WHERE id = ?`,
        [
          p.amount === undefined ? null : p.amount,
          p.currency || null,
          p.stripe_payment_intent_id || null,
          payment.id
        ]
      );
      return paymentDAL.getById(payment.id, db);
    }

    const result = await paymentDAL.create({
      order_id: p.order_id,
      provider: 'STRIPE',
      status: p.status || 'PENDING',
      amount: p.amount,
      currency: p.currency,
      stripe_payment_intent_id: p.stripe_payment_intent_id || null,
      paid_at: p.paid_at || null
    }, db);

    return paymentDAL.getById(result.insertId, db);
  },

  markPaymentSucceeded: async ({ id, stripe_payment_intent_id }, db = pool) => {
    const [result] = await db.query(
      `UPDATE payments
       SET status = 'SUCCEEDED',
           stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           paid_at = COALESCE(paid_at, NOW())
       WHERE id = ?
         AND status <> 'SUCCEEDED'`,
      [stripe_payment_intent_id || null, id]
    );
    return result;
  },

  markPaymentFailed: async ({ id, stripe_payment_intent_id }, db = pool) => {
    const [result] = await db.query(
      `UPDATE payments
       SET status = 'FAILED',
           stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           paid_at = NULL
       WHERE id = ?
         AND status NOT IN ('FAILED', 'SUCCEEDED', 'REFUNDED')`,
      [stripe_payment_intent_id || null, id]
    );
    return result;
  },

  markPaymentRefunded: async ({ id }, db = pool) => {
    const [result] = await db.query(
      `UPDATE payments
       SET status = 'REFUNDED'
       WHERE id = ?
         AND status <> 'REFUNDED'`,
      [id]
    );
    return result;
  },

  markSucceededByOrderId: async ({ order_id, stripe_payment_intent_id }, db = pool) => {
    const payment = await paymentDAL.upsertStripePaymentForOrder({
      order_id,
      provider: 'STRIPE',
      status: 'PENDING',
      stripe_payment_intent_id
    }, db);

    return paymentDAL.markPaymentSucceeded({
      id: payment.id,
      stripe_payment_intent_id
    }, db);
  }
};

module.exports = paymentDAL;
