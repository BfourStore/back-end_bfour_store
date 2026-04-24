const categoryDAL = require('../dal/categoryDAL');

const categoryBLL = {
  create: async (data) => {
    const exists = await categoryDAL.getBySlug(data.slug);
    if (exists) {
      const err = new Error('Slug já existe');
      err.status = 409;
      throw err;
    }
    return categoryDAL.create(data);
  },
  list: async () => categoryDAL.list(),
  update: async (id, data) => categoryDAL.update(id, data),
  delete: async (id) => categoryDAL.delete(id)
};

module.exports = categoryBLL;
