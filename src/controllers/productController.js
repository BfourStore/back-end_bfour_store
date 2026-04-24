const productBLL = require('../bll/productBLL');

const productController = {
  list: async (req, res) => {
    try {
      const rows = await productBLL.list();
      // front espera { products: [...] }
      return res.status(200).json({ products: rows });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao listar produtos', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const product = await productBLL.getById(req.params.id);
      return res.status(200).json({ product });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao buscar produto', error: err.message });
    }
  },

  getRecommendations: async (req, res) => {
    try {
      const rows = await productBLL.getRecommendationsByVariantId(req.params.id);
      return res.status(200).json({ products: rows });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao buscar recomendados', error: err.message });
    }
  },

  create: async (req, res) => {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).send({ message: 'name e slug são obrigatórios' });

    try {
      const result = await productBLL.create(req.body);
      return res.status(201).send({ message: 'Produto criado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao criar produto', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const result = await productBLL.update(req.params.id, req.body);
      return res.status(200).send({ message: 'Produto atualizado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao atualizar produto', error: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const result = await productBLL.delete(req.params.id);
      return res.status(200).send({ message: 'Produto deletado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao deletar produto', error: err.message });
    }
  },

  addImage: async (req, res) => {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).send({ message: 'image_url é obrigatório' });

    try {
      const result = await productBLL.addImage(req.params.id, req.body);
      return res.status(201).send({ message: 'Imagem adicionada', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao adicionar imagem', error: err.message });
    }
  },

  addVariant: async (req, res) => {
    const { sku, price } = req.body;
    if (!sku || price === undefined) return res.status(400).send({ message: 'sku e price são obrigatórios' });

    try {
      const result = await productBLL.addVariant(req.params.id, req.body);
      return res.status(201).send({ message: 'Variant criada', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao criar variant', error: err.message });
    }
  },

  updateInventory: async (req, res) => {
    try {
      const result = await productBLL.updateInventory(req.params.variantId, req.body);
      return res.status(200).send({ message: 'Estoque atualizado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao atualizar estoque', error: err.message });
    }
  }
};

module.exports = productController;
