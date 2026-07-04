const paymentBLL = require('../bll/paymentBLL');

const paymentController = {
  create: async (req, res) => {
    try {
      const result = await paymentBLL.create(req.body);
      return res.status(201).send({ message: 'Pagamento registrado', data: result });
    } catch (err) {
      return res.status(err.status || 500).send({ message: err.message || 'Erro ao registrar pagamento' });
    }
  },

  getById: async (req, res) => {
    try {
      const payment = await paymentBLL.getById(req.params.id);
      return res.status(200).send(payment);
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao buscar pagamento' });
    }
  },

  createStripeCheckoutSession: async (req, res) => {
    try {
      const result = await paymentBLL.createStripeCheckoutSession(req.user.id, req.body.order_id);
      return res.status(201).send(result);
    } catch (err) {
      return res.status(err.status || 500).send({
        message: err.message || 'Erro ao criar sessão de checkout'
      });
    }
  },

  handleStripeWebhook: async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'];
      const result = await paymentBLL.handleStripeWebhook(req.body, signature);
      return res.status(200).send(result);
    } catch (err) {
      return res.status(err.status || 500).send({
        message: err.message || 'Erro ao processar webhook Stripe'
      });
    }
  }
};

module.exports = paymentController;
