const paymentDAL = require('../dal/paymentDAL');
const orderDAL = require('../dal/orderDAL');
const { pool } = require('../config/dbConfig');
const stripeService = require('../services/stripeService');

const STRIPE_PROVIDER = 'STRIPE';
const STRIPE_CURRENCY = 'USD';

function toMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toStripeAmount(value) {
  return Math.round(Number(value) * 100);
}

function recalculateOrderPayment(order, items) {
  if (!items || items.length === 0) {
    const err = new Error('Pedido não possui itens para pagamento');
    err.status = 400;
    throw err;
  }

  const subtotal = toMoney(items.reduce((sum, item) => {
    return sum + Number(item.current_unit_price) * Number(item.quantity);
  }, 0));

  const discount = toMoney(order.discount_total);
  const shipping = toMoney(order.shipping_total);
  const total = toMoney(subtotal - discount + shipping);

  if (total <= 0) {
    const err = new Error('Total do pedido inválido para pagamento');
    err.status = 400;
    throw err;
  }

  const lineItems = [{
    price_data: {
      currency: STRIPE_CURRENCY.toLowerCase(),
      product_data: {
        name: `Pedido ${order.order_number}`,
        metadata: {
          order_id: String(order.id),
          order_number: String(order.order_number)
        }
      },
      unit_amount: toStripeAmount(total)
    },
    quantity: 1
  }];

  return {
    subtotal,
    discount_total: discount,
    shipping_total: shipping,
    total,
    currency: STRIPE_CURRENCY,
    lineItems
  };
}

const paymentBLL = {
  create: async (data) => {
    if (!data.order_id || !data.provider || data.amount === undefined || !data.currency) {
      const err = new Error('order_id, provider, amount e currency são obrigatórios');
      err.status = 400;
      throw err;
    }
    return paymentDAL.create(data);
  },
  getById: async (id) => paymentDAL.getById(id),

  createStripeCheckoutSession: async (userId, orderId) => {
    if (!orderId) {
      const err = new Error('order_id é obrigatório');
      err.status = 400;
      throw err;
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const order = await orderDAL.getOrderByIdForUpdate(orderId, conn);

      if (!order) {
        const err = new Error('Pedido não encontrado');
        err.status = 404;
        throw err;
      }

      if (Number(order.user_id) !== Number(userId)) {
        const err = new Error('Sem permissão para pagar este pedido');
        err.status = 403;
        throw err;
      }

      if (order.status !== 'PENDING') {
        const err = new Error(`Pedido não pode ser pago com status ${order.status}`);
        err.status = 400;
        throw err;
      }

      const items = await orderDAL.listOrderItemsForPayment(orderId, conn);
      const paymentData = recalculateOrderPayment(order, items);

      await orderDAL.updateOrderTotals(orderId, paymentData, conn);

      let payment = await paymentDAL.getLatestByOrderId(orderId, conn);
      if (!payment) {
        const result = await paymentDAL.create({
          order_id: orderId,
          provider: STRIPE_PROVIDER,
          status: 'PENDING',
          amount: paymentData.total,
          currency: STRIPE_CURRENCY
        }, conn);
        payment = { id: result.insertId };
      }

      await conn.commit();

      const session = await stripeService.createCheckoutSession({
        order: { ...order, currency: STRIPE_CURRENCY },
        lineItems: paymentData.lineItems
      });

      await paymentDAL.updateStripeSessionCreated({
        id: payment.id,
        amount: paymentData.total,
        currency: STRIPE_CURRENCY
      });

      return {
        sessionId: session.id,
        checkoutUrl: session.url
      };
    } catch (err) {
      try {
        await conn.rollback();
      } catch (_) {
        // Transaction may already be committed before Stripe session creation.
      }
      throw err;
    } finally {
      conn.release();
    }
  },

  handleStripeWebhook: async (payload, signature) => {
    let event;

    try {
      event = stripeService.constructWebhookEvent(payload, signature);
    } catch (err) {
      const signatureError = new Error('Assinatura do webhook Stripe inválida');
      signatureError.status = 400;
      throw signatureError;
    }

    if (event.type !== 'checkout.session.completed') {
      return { received: true, ignored: true };
    }

    const session = event.data.object;
    if (session.payment_status !== 'paid') {
      return { received: true, ignored: true };
    }

    const orderId = session.metadata?.order_id || session.client_reference_id;

    if (!orderId) {
      const err = new Error('Webhook Stripe sem order_id');
      err.status = 400;
      throw err;
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const order = await orderDAL.getOrderByIdForUpdate(orderId, conn);
      if (!order) {
        const err = new Error('Pedido não encontrado para webhook Stripe');
        err.status = 404;
        throw err;
      }

      const paymentResult = await paymentDAL.markSucceededByOrderId({
        order_id: orderId,
        stripe_payment_intent_id: session.payment_intent
      }, conn);

      if (paymentResult.affectedRows === 0) {
        await paymentDAL.create({
          order_id: orderId,
          provider: STRIPE_PROVIDER,
          status: 'SUCCEEDED',
          amount: Number(session.amount_total || 0) / 100,
          currency: String(session.currency || STRIPE_CURRENCY).toUpperCase(),
          stripe_payment_intent_id: session.payment_intent,
          paid_at: new Date()
        }, conn);
      }

      await orderDAL.updateOrderStatus(orderId, 'PAID', conn);

      // TODO: reduzir estoque após confirmação do pagamento quando o fluxo de reserva for ajustado.

      await conn.commit();
      return { received: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
};

module.exports = paymentBLL;
