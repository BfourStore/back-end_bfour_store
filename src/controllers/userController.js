const userBLL = require('../bll/userBLL');

const userController = {
  me: async (req, res) => {
    try {
      const user = await userBLL.getById(req.user.id);
      return res.status(200).send(user);
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao buscar usuário' });
    }
  },

  getById: async (req, res) => {
    try {
      const user = await userBLL.getById(req.params.id);
      return res.status(200).send(user);
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao buscar usuário' });
    }
  },

  list: async (req, res) => {
    try {
      const users = await userBLL.list();
      return res.status(200).send(users);
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao listar usuários' });
    }
  },

  update: async (req, res) => {
    try {
      const result = await userBLL.update(req.params.id, req.body);
      return res.status(200).send({ message: 'Atualizado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao atualizar usuário' });
    }
  },

  delete: async (req, res) => {
    try {
      const result = await userBLL.delete(req.params.id);
      return res.status(200).send({ message: 'Deletado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao deletar usuário' });
    }
  }
};

module.exports = userController;
