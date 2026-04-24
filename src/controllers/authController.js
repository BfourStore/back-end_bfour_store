const authBLL = require('../bll/authBLL');

const authController = {
  register: async (req, res) => {
    const { full_name, email, password, phone } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).send({ message: 'full_name, email e password são obrigatórios' });
    }

    try {
      const user = await authBLL.register({ full_name, email, password, phone });
      return res.status(201).send({ message: 'Usuário criado com sucesso', data: user });
    } catch (err) {
      return res.status(err.status || 500).send({ message: err.message || 'Erro ao registrar' });
    }
  },

  login: async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send({ message: 'email e password são obrigatórios' });
    }

    try {
      const result = await authBLL.login({ email, password });
      return res.status(200).send(result);
    } catch (err) {
      return res.status(err.status || 500).send({ message: err.message || 'Erro ao logar' });
    }
  }
};

module.exports = authController;
