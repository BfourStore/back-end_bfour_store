const paymentDAL = require('../dal/paymentDAL');

const paymentBLL = {
  create: async (data) => {
    if (!data.order_id || !data.provider || data.amount === undefined || !data.currency) {
      const err = new Error('order_id, provider, amount e currency são obrigatórios');
      err.status = 400;
      throw err;
    }
    return paymentDAL.create(data);
  },
  getById: async (id) => paymentDAL.getById(id)
};

module.exports = paymentBLL;
