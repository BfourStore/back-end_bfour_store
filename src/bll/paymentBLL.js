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

function getOrderIdFromCheckoutSession(session) {
  return session?.metadata?.order_id || session?.client_reference_id || null;
}

function getOrderIdFromStripeObject(stripeObject) {
  return stripeObject?.metadata?.order_id
    || stripeObject?.metadata?.orderId
    || stripeObject?.client_reference_id
    || null;
}

function getPaymentIntentIdFromStripeObject(stripeObject) {
  if (!stripeObject) return null;
  if (stripeObject.object === 'payment_intent') return stripeObject.id;
  return stripeObject.payment_intent || null;
}

function getAmountFromStripeObject(stripeObject, order) {
  const amount = stripeObject?.amount_total || stripeObject?.amount || stripeObject?.amount_received;
  if (amount) return Number(amount) / 100;
  return Number(order.total || 0);
}

function getCurrencyFromStripeObject(stripeObject, order) {
  return String(stripeObject?.currency || order.currency || STRIPE_CURRENCY).toUpperCase();
}

function logStripeWebhook(message, data = {}) {
  console.log('[Stripe Webhook]', message, data);
}

async function getOrderAndPayment({ orderId, paymentIntentId, stripeObject, conn }) {
  let payment = paymentIntentId
    ? await paymentDAL.getPaymentByStripePaymentIntentId(paymentIntentId, conn)
    : null;

  const resolvedOrderId = orderId || payment?.order_id || getOrderIdFromStripeObject(stripeObject);

  if (!resolvedOrderId) {
    return { order: null, payment, orderId: null };
  }

  const order = await orderDAL.getOrderByIdForUpdate(resolvedOrderId, conn);
  if (!order) {
    return { order: null, payment, orderId: resolvedOrderId };
  }

  if (!payment) {
    payment = await paymentDAL.upsertStripePaymentForOrder({
      order_id: order.id,
      status: 'PENDING',
      amount: getAmountFromStripeObject(stripeObject, order),
      currency: getCurrencyFromStripeObject(stripeObject, order),
      stripe_payment_intent_id: paymentIntentId || null
    }, conn);
  }

  return { order, payment, orderId: order.id };
}

async function handleCheckoutSessionCompleted(session, conn) {
  if (session.payment_status !== 'paid') {
    logStripeWebhook('checkout.session.completed ignorado: payment_status nao pago', {
      session_id: session.id,
      payment_status: session.payment_status
    });
    return { received: true, ignored: true };
  }

  const orderId = getOrderIdFromCheckoutSession(session);
  const paymentIntentId = getPaymentIntentIdFromStripeObject(session);
  return handleStripePaymentSucceeded({
    orderId,
    paymentIntentId,
    stripeObject: session,
    eventName: 'checkout.session.completed',
    conn
  });
}

async function handleStripePaymentSucceeded({ orderId, paymentIntentId, stripeObject, eventName, conn }) {
  const { order, payment } = await getOrderAndPayment({
    orderId,
    paymentIntentId,
    stripeObject,
    conn
  });

  if (!order) {
    logStripeWebhook(`${eventName} ignorado: pedido nao encontrado`, {
      payment_intent: paymentIntentId,
      order_id: orderId
    });
    return { received: true, ignored: true };
  }

  if (payment.status === 'SUCCEEDED' && order.status === 'PAID') {
    logStripeWebhook(`${eventName} ignorado por idempotencia`, {
      order_id: order.id,
      payment_id: payment.id
    });
    return { received: true, ignored: true };
  }

  const paymentResult = await paymentDAL.markPaymentSucceeded({
    id: payment.id,
    stripe_payment_intent_id: paymentIntentId
  }, conn);

  const orderResult = await orderDAL.updateOrderStatusIfCurrent(order.id, 'PAID', ['PENDING'], conn);

  // TODO: baixar estoque somente aqui, apos pagamento confirmado e com fluxo de reserva definido.

  logStripeWebhook('pagamento confirmado', {
    event: eventName,
    order_id: order.id,
    payment_id: payment.id,
    payment_updated: paymentResult.affectedRows,
    order_updated: orderResult.affectedRows
  });

  return { received: true };
}

async function handlePaymentIntentSucceeded(paymentIntent, conn) {
  return handleStripePaymentSucceeded({
    orderId: getOrderIdFromStripeObject(paymentIntent),
    paymentIntentId: getPaymentIntentIdFromStripeObject(paymentIntent),
    stripeObject: paymentIntent,
    eventName: 'payment_intent.succeeded',
    conn
  });
}

async function handleChargeSucceeded(charge, conn) {
  if (charge.status !== 'succeeded') {
    logStripeWebhook('charge ignorado: status nao concluido', {
      charge_id: charge.id,
      status: charge.status
    });
    return { received: true, ignored: true };
  }

  return handleStripePaymentSucceeded({
    orderId: getOrderIdFromStripeObject(charge),
    paymentIntentId: getPaymentIntentIdFromStripeObject(charge),
    stripeObject: charge,
    eventName: 'charge.succeeded',
    conn
  });
}

async function handleCheckoutSessionExpired(session, conn) {
  const orderId = getOrderIdFromCheckoutSession(session);
  const { order, payment } = await getOrderAndPayment({
    orderId,
    paymentIntentId: session.payment_intent || null,
    stripeObject: session,
    conn
  });

  if (!order) {
    logStripeWebhook('checkout.session.expired ignorado: pedido nao encontrado', { order_id: orderId });
    return { received: true, ignored: true };
  }

  const paymentResult = await paymentDAL.markPaymentFailed({
    id: payment.id,
    stripe_payment_intent_id: session.payment_intent || null
  }, conn);

  // Regra simples: sessao expirada cancela apenas pedidos ainda PENDING.
  const orderResult = await orderDAL.updateOrderStatusIfCurrent(order.id, 'CANCELLED', ['PENDING'], conn);

  logStripeWebhook('checkout expirado processado', {
    order_id: order.id,
    payment_id: payment.id,
    payment_updated: paymentResult.affectedRows,
    order_updated: orderResult.affectedRows
  });

  return { received: true };
}

async function handlePaymentIntentFailed(paymentIntent, conn) {
  const paymentIntentId = paymentIntent.id;
  const orderId = getOrderIdFromStripeObject(paymentIntent);
  const { order, payment } = await getOrderAndPayment({
    orderId,
    paymentIntentId,
    stripeObject: paymentIntent,
    conn
  });

  if (!order) {
    logStripeWebhook('payment_intent.payment_failed ignorado: pedido nao encontrado', {
      payment_intent: paymentIntentId,
      order_id: orderId
    });
    return { received: true, ignored: true };
  }

  const paymentResult = await paymentDAL.markPaymentFailed({
    id: payment.id,
    stripe_payment_intent_id: paymentIntentId
  }, conn);

  // Regra simples: falha definitiva cancela apenas pedidos ainda PENDING.
  const orderResult = await orderDAL.updateOrderStatusIfCurrent(order.id, 'CANCELLED', ['PENDING'], conn);

  logStripeWebhook('falha de pagamento processada', {
    order_id: order.id,
    payment_id: payment.id,
    payment_updated: paymentResult.affectedRows,
    order_updated: orderResult.affectedRows
  });

  return { received: true };
}

async function handleRefund(stripeObject, conn) {
  if (stripeObject.object === 'refund' && stripeObject.status !== 'succeeded') {
    logStripeWebhook('refund.updated ignorado: refund ainda nao concluido', {
      refund_id: stripeObject.id,
      status: stripeObject.status
    });
    return { received: true, ignored: true };
  }

  const paymentIntentId = stripeObject.payment_intent || null;
  const orderId = getOrderIdFromStripeObject(stripeObject);
  const { order, payment } = await getOrderAndPayment({
    orderId,
    paymentIntentId,
    stripeObject,
    conn
  });

  if (!order || !payment) {
    logStripeWebhook('refund ignorado: pagamento/pedido nao encontrado', {
      payment_intent: paymentIntentId,
      order_id: orderId
    });
    return { received: true, ignored: true };
  }

  if (payment.status === 'REFUNDED' && order.status === 'REFUNDED') {
    logStripeWebhook('refund ignorado por idempotencia', {
      order_id: order.id,
      payment_id: payment.id
    });
    return { received: true, ignored: true };
  }

  const paymentResult = await paymentDAL.markPaymentRefunded({ id: payment.id }, conn);
  const orderResult = await orderDAL.updateOrderStatusIfCurrent(
    order.id,
    'REFUNDED',
    ['PENDING', 'PAID', 'CANCELLED', 'SHIPPED', 'DELIVERED'],
    conn
  );

  logStripeWebhook('refund processado', {
    order_id: order.id,
    payment_id: payment.id,
    payment_updated: paymentResult.affectedRows,
    order_updated: orderResult.affectedRows
  });

  return { received: true };
}

async function processStripeEvent(event, conn) {
  logStripeWebhook('evento recebido', { event_id: event.id, type: event.type });

  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(event.data.object, conn);
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event.data.object, conn);
    case 'charge.succeeded':
    case 'charge.updated':
      return handleChargeSucceeded(event.data.object, conn);
    case 'checkout.session.expired':
      return handleCheckoutSessionExpired(event.data.object, conn);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event.data.object, conn);
    case 'charge.refunded':
    case 'refund.updated':
      return handleRefund(event.data.object, conn);
    default:
      logStripeWebhook('evento ignorado', { event_id: event.id, type: event.type });
      return { received: true, ignored: true };
  }
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

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();
      const result = await processStripeEvent(event, conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
};

module.exports = paymentBLL;
