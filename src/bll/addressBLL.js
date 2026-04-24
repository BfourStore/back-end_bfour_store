const addressDAL = require('../dal/addressDAL');

const addressBLL = {
  create: async (userId, data) => {
    return addressDAL.create({ ...data, user_id: userId });
  },
  listMy: async (userId) => addressDAL.listByUser(userId),
  update: async (id, data) => addressDAL.update(id, data),
  delete: async (id) => addressDAL.delete(id)
};

module.exports = addressBLL;
