const Stripe = require('stripe');

let stripeClient = null;

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error('STRIPE_SECRET_KEY não configurada');
    err.status = 500;
    throw err;
  }

  if (!stripeClient) {
    stripeClient = Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

function getStripeWebhookSecret() {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    const err = new Error('STRIPE_WEBHOOK_SECRET não configurada');
    err.status = 500;
    throw err;
  }

  return process.env.STRIPE_WEBHOOK_SECRET;
}

async function createCheckoutSession({ order, lineItems }) {
  const stripe = getStripeClient();
  const baseUrl = getAppBaseUrl();

  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
    cancel_url: `${baseUrl}/checkout/cancel?order_id=${order.id}`,
    client_reference_id: String(order.id),
    metadata: {
      order_id: String(order.id),
      order_number: String(order.order_number)
    }
  });
}

function constructWebhookEvent(payload, signature) {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
}

module.exports = {
  createCheckoutSession,
  constructWebhookEvent
};
