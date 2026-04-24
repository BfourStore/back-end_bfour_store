const orderBLL = require('../bll/orderBLL');

const orderController = {
  create: async (req, res) => {
    try {
      const order = await orderBLL.create(req.user.id, req.body);
      return res.status(201).send(order);
    } catch (err) {
      return res.status(err.status || 500).send({
        message: err.message || 'Erro ao criar pedido',
        details: err.details
      });
    }
  },

  placeOrderFromCart: async (req, res) => {
    try {
      const order = await orderBLL.placeOrderFromCart(req.user.id, req.body);
      return res.status(201).send(order);
    } catch (err) {
      return res.status(err.status || 400).send({
        message: err.message,
        details: err.details
      });
    }
  },

  getById: async (req, res) => {
    try {
      const order = await orderBLL.getById(req.params.id);
      return res.status(200).send(order);
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao buscar pedido', error: err.message });
    }
  },

  cancel: async (req, res) => {
    try {
      const order = await orderBLL.cancel(req.params.id, req.user);
      return res.status(200).send({
        message: 'Pedido cancelado com sucesso',
        data: order
      });
    } catch (err) {
      return res.status(err.status || 500).send({
        message: err.message || 'Erro ao cancelar pedido',
        details: err.details
      });
    }
  },

  listMy: async (req, res) => {
    try {
      const orders = await orderBLL.listMy(req.user.id);
      return res.status(200).send(orders);
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao listar pedidos', error: err.message });
    }
  }
};

module.exports = orderController;
