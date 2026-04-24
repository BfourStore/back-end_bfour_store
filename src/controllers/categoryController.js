const categoryBLL = require('../bll/categoryBLL');

const categoryController = {
  create: async (req, res) => {
    const { name, slug, parent_id } = req.body;
    if (!name || !slug) return res.status(400).send({ message: 'name e slug são obrigatórios' });

    try {
      const result = await categoryBLL.create({ name, slug, parent_id });
      return res.status(201).send({ message: 'Categoria criada', data: result });
    } catch (err) {
      return res.status(err.status || 500).send({ message: err.message || 'Erro ao criar categoria' });
    }
  },

  list: async (req, res) => {
    try {
      const rows = await categoryBLL.list();
      return res.status(200).send(rows);
    } catch {
      return res.status(500).send({ message: 'Erro ao listar categorias' });
    }
  },

  update: async (req, res) => {
    try {
      const result = await categoryBLL.update(req.params.id, req.body);
      return res.status(200).send({ message: 'Categoria atualizada', data: result });
    } catch {
      return res.status(500).send({ message: 'Erro ao atualizar categoria' });
    }
  },

  delete: async (req, res) => {
    try {
      const result = await categoryBLL.delete(req.params.id);
      return res.status(200).send({ message: 'Categoria deletada', data: result });
    } catch {
      return res.status(500).send({ message: 'Erro ao deletar categoria' });
    }
  }
};

module.exports = categoryController;
