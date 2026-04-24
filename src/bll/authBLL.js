const jwt = require('jsonwebtoken');
const userDAL = require('../dal/userDAL');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');

const authBLL = {
  register: async ({ full_name, email, password, phone }) => {
    const existing = await userDAL.getUserByEmail(email);
    if (existing) {
      const err = new Error('E-mail já cadastrado');
      err.status = 409;
      throw err;
    }

    const password_hash = password ? await hashPassword(password) : null;

    const result = await userDAL.createUser({
      full_name,
      email,
      password_hash,
      phone,
      role: 'CUSTOMER'
    });

    const createdUser = await userDAL.getUserById(result.insertId);
    return createdUser;
  },

  login: async ({ email, password }) => {
    const user = await userDAL.getUserByEmail(email);
    if (!user) {
      const err = new Error('Credenciais inválidas');
      err.status = 401;
      throw err;
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      const err = new Error('Credenciais inválidas');
      err.status = 401;
      throw err;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    };
  }
};

module.exports = authBLL;
