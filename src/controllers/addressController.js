const addressBLL = require('../bll/addressBLL');

const addressController = {
  create: async (req, res) => {
    const body = req.body;
    if (!body.receiver_name || !body.country || !body.state || !body.city || !body.street || !body.zip_code) {
      return res.status(400).send({ message: 'Campos obrigatórios: receiver_name, country, state, city, street, zip_code' });
    }
    try {
      const result = await addressBLL.create(req.user.id, body);
      return res.status(201).send({ message: 'Endereço criado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao criar endereço', error: err.message });
    }
  },

  listMy: async (req, res) => {
    try {
      const rows = await addressBLL.listMy(req.user.id);
      return res.status(200).send(rows);
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao listar endereços' });
    }
  },

  update: async (req, res) => {
    try {
      const result = await addressBLL.update(req.params.id, req.body);
      return res.status(200).send({ message: 'Endereço atualizado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao atualizar endereço' });
    }
  },

  delete: async (req, res) => {
    try {
      const result = await addressBLL.delete(req.params.id);
      return res.status(200).send({ message: 'Endereço deletado', data: result });
    } catch (err) {
      return res.status(500).send({ message: 'Erro ao deletar endereço' });
    }
  }
};

module.exports = addressController;
