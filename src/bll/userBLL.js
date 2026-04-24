const userDAL = require('../dal/userDAL');

const userBLL = {
  getById: async (id) => userDAL.getUserById(id),
  list: async () => userDAL.listUsers(),
  update: async (id, data) => userDAL.updateUser(id, data),
  delete: async (id) => userDAL.deleteUser(id)
};

module.exports = userBLL;
