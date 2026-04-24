const cartBLL = require('../bll/cartBLL');

const cartController = {
  getActive: async (req, res) => {
    try {
      const cart = await cartBLL.getActiveCart(req.user.id);
      return res.status(200).send(cart || { status: 'EMPTY' });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao buscar carrinho', error: err.message });
    }
  },

  addItem: async (req, res) => {
    const { variant_id, quantity } = req.body;
    if (!variant_id) return res.status(400).send({ message: 'variant_id é obrigatório' });

    try {
      const cart = await cartBLL.addItemToActiveCart(req.user.id, { variant_id, quantity });
      return res.status(201).send(cart);
    } catch (err) {
      return res.status(err.status || 500).send({ message: err.message || 'Erro ao adicionar item' });
    }
  },

  updateItemQty: async (req, res) => {
    const { quantity } = req.body;
    if (quantity === undefined) return res.status(400).send({ message: 'quantity é obrigatório' });

    try {
      const result = await cartBLL.updateItemQty(req.params.id, quantity);
      return res.status(200).send({ message: 'Quantidade atualizada', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao atualizar item', error: err.message });
    }
  },

  deleteItem: async (req, res) => {
    try {
      const result = await cartBLL.deleteItem(req.params.id);
      return res.status(200).send({ message: 'Item removido', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao remover item', error: err.message });
    }
  }
  ,

  // -----------------------------------------------------------------------
  // Compatibilidade com template do front (sem autenticação)
  // GET /users/:id/cart
  // POST /users/:id/cart  body: { productId, increase, decrease }
  // -----------------------------------------------------------------------
  getCartForTemplate: async (req, res) => {
    try {
      const cart = await cartBLL.getCartForTemplate(Number(req.params.id));
      return res.status(200).json({ cart });
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message || 'Erro ao buscar carrinho' });
    }
  },

  postCartForTemplate: async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { productId, increase, decrease } = req.body || {};
      if (!productId) {
        return res.status(400).json({ message: 'productId é obrigatório' });
      }

      const cart = await cartBLL.postCartForTemplate(userId, productId, !!increase, !!decrease);
      return res.status(200).json({ cart });
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message || 'Erro ao atualizar carrinho' });
    }
  }
};

module.exports = cartController;
