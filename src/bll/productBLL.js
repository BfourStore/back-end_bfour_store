const productDAL = require('../dal/productDAL');

const productBLL = {
  create: async (data) => {
    if (data.is_active === undefined) data.is_active = true;
    return productDAL.createProduct(data);
  },
  // Storefront (retorna formato compatível com o template do front)
  list: async () => productDAL.listStoreProducts(),
  getById: async (id) => productDAL.getStoreProductByVariantId(id),
  update: async (id, data) => productDAL.updateProduct(id, data),
  delete: async (id) => productDAL.deleteProduct(id),

  addImage: async (productId, data) => {
    return productDAL.addImage({
      product_id: productId,
      image_url: data.image_url,
      sort_order: data.sort_order || 0,
      is_cover: !!data.is_cover
    });
  },

  addVariant: async (productId, data) => {
    if (data.is_active === undefined) data.is_active = true;
    return productDAL.addVariant({
      product_id: productId,
      sku: data.sku,
      color: data.color,
      size: data.size,
      price: data.price,
      compare_at_price: data.compare_at_price,
      is_active: data.is_active
    });
  },

  getRecommendationsByVariantId: async (variantId) => {
    return productDAL.listRecommendedByVariantId(variantId, 8);
  },

  updateInventory: async (variantId, data) => {
    return productDAL.upsertInventory({
      variant_id: variantId,
      quantity: data.quantity,
      low_stock_threshold: data.low_stock_threshold
    });
  }
};

module.exports = productBLL;
