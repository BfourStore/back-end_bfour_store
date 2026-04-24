const cartDAL = require('../dal/cartDAL');

// Constrói o payload esperado pelo template React (fashion-cube)
function buildTemplateCart(itemsDetailed) {
  const items = {};
  let totalQty = 0;
  let totalPrice = 0;

  for (const r of itemsDetailed) {
    const department = r.parent_category_name || r.category_name || "Shop";
    const category = r.category_name || department;

    const product = {
      _id: String(r.variant_id),
      title: r.product_name,
      department,
      category,
      price: Number(r.unit_price),
      imagePath: r.image_url || "",
      description: r.description || "",
      color: r.color || "",
      size: r.size || "",
      sku: r.sku,
    };

    items[String(r.variant_id)] = {
      item: product,
      qty: Number(r.quantity),
      price: Number(r.unit_price),
    };

    totalQty += Number(r.quantity);
    totalPrice += Number(r.unit_price) * Number(r.quantity);
  }

  // Se não houver itens, o template trata como carrinho vazio quando items é null/undefined.
  if (Object.keys(items).length === 0) {
    return { items: null, totalQty: 0, totalPrice: 0 };
  }

  return {
    items,
    totalQty,
    totalPrice: Number(totalPrice.toFixed(2)),
  };
}

const cartBLL = {
  getOrCreateActiveCart: async (userId) => {
    let cart = await cartDAL.getActiveCartByUser(userId);
    if (!cart) {
      const result = await cartDAL.createCart(userId);
      cart = { id: result.insertId, user_id: userId, status: 'ACTIVE' };
    }
    return cart;
  },

  getActiveCart: async (userId) => {
    const cart = await cartDAL.getActiveCartByUser(userId);
    if (!cart) return null;
    const items = await cartDAL.listItems(cart.id);
    return { ...cart, items };
  },

  addItemToActiveCart: async (userId, { variant_id, quantity }) => {
    const cart = await cartBLL.getOrCreateActiveCart(userId);

    const v = await cartDAL.getVariantPrice(variant_id);
    if (!v) {
      const err = new Error('Variant inválida ou inativa');
      err.status = 400;
      throw err;
    }

    await cartDAL.addItem({
      cart_id: cart.id,
      variant_id,
      quantity: Number(quantity || 1),
      unit_price: v.price // congelado
    });

    await cartDAL.touchCart(cart.id);
    return cartBLL.getActiveCart(userId);
  },

  // -------------------------------------------------------------------------
  // Endpoints compatíveis com o template do front
  // -------------------------------------------------------------------------
  getCartForTemplate: async (userId) => {
    const cart = await cartBLL.getOrCreateActiveCart(userId);
    const detailed = await cartDAL.listItemsDetailedForTemplate(cart.id);
    return buildTemplateCart(detailed);
  },

  postCartForTemplate: async (userId, variantId, increase, decrease) => {
    const cart = await cartBLL.getOrCreateActiveCart(userId);
    const variant_id = Number(variantId);

    const v = await cartDAL.getVariantPrice(variant_id);
    if (!v) {
      const err = new Error('Produto/variant inválido ou inativo');
      err.status = 400;
      throw err;
    }

    const existing = await cartDAL.getItemByCartAndVariant(cart.id, variant_id);
    if (!existing) {
      await cartDAL.addItem({ cart_id: cart.id, variant_id, quantity: 1, unit_price: v.price });
    } else {
      const currentQty = Number(existing.quantity);
      let nextQty = currentQty;
      if (increase) nextQty = currentQty + 1;
      else if (decrease) nextQty = currentQty - 1;
      else nextQty = currentQty + 1;

      if (nextQty <= 0) {
        await cartDAL.deleteItem(existing.id);
      } else {
        await cartDAL.updateItemQty(existing.id, nextQty);
      }
    }

    await cartDAL.touchCart(cart.id);
    const detailed = await cartDAL.listItemsDetailedForTemplate(cart.id);
    return buildTemplateCart(detailed);
  },

  updateItemQty: async (itemId, quantity) => cartDAL.updateItemQty(itemId, Number(quantity)),
  deleteItem: async (itemId) => cartDAL.deleteItem(itemId)
};

module.exports = cartBLL;
