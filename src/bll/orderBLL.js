const orderDAL = require('../dal/orderDAL');
const inventoryDAL = require('../dal/inventoryDAL');
const { pool } = require('../config/dbConfig');
const { generateOrderNumber } = require('../utils/orderNumber');

function createOutOfStockError({ snap, variantId, requested, available }) {
  const productName = snap?.product_name || 'Produto';
  const err = new Error(
    `Sem estoque para ${productName} (variant_id: ${variantId}). Solicitado: ${requested}. Disponível: ${available}.`
  );
  err.status = 400;
  err.details = {
    code: 'OUT_OF_STOCK',
    order_id: null,
    variant_id: Number(variantId),
    product_name: productName,
    requested_quantity: requested,
    available_quantity: available
  };
  return err;
}

const NON_CANCELABLE_STATUSES = ['CANCELLED', 'SHIPPED', 'DELIVERED'];

function formatOrderWithAddress(order) {
  const {
    address_receiver_name,
    address_phone,
    address_country,
    address_state,
    address_city,
    address_neighborhood,
    address_street,
    address_number,
    address_complement,
    address_zip_code,
    address_is_default,
    address_created_at,
    ...orderData
  } = order;

  const address = order.address_id
    ? {
        id: order.address_id,
        receiver_name: address_receiver_name,
        phone: address_phone,
        country: address_country,
        state: address_state,
        city: address_city,
        neighborhood: address_neighborhood,
        street: address_street,
        number: address_number,
        complement: address_complement,
        zip_code: address_zip_code,
        is_default: address_is_default,
        created_at: address_created_at
      }
    : null;

  return { ...orderData, address };
}

function formatOrderItems(items) {
  return items.map(item => ({
    ...item,
    imagePath: item.image_url || ''
  }));
}

async function buildOrderItemsWithStockValidation(items, db) {
  let subtotal = 0;
  const orderItems = [];

  for (const it of items) {
    const variantId = it.variant_id;
    const qty = Number(it.quantity || 1);

    if (!variantId || !Number.isFinite(qty) || qty <= 0) {
      const err = new Error('variant_id e quantity maior que zero são obrigatórios em todos os items');
      err.status = 400;
      throw err;
    }

    const snap = await orderDAL.getVariantSnapshot(variantId, db);
    if (!snap) {
      const err = new Error(`Variant inválida: ${variantId}`);
      err.status = 400;
      throw err;
    }

    const stock = await inventoryDAL.getByVariantIdForUpdate(variantId, db);
    const available = Number(stock?.quantity || 0);

    if (!stock || available < qty) {
      throw createOutOfStockError({
        snap,
        variantId,
        requested: qty,
        available
      });
    }

    const unit = Number(it.unit_price ?? snap.price);
    const line = qty * unit;

    subtotal += line;

    orderItems.push({
      variant_id: snap.variant_id,
      product_name: snap.product_name,
      variant_sku: snap.sku,
      color: snap.color,
      size: snap.size,
      quantity: qty,
      unit_price: unit,
      line_total: line
    });
  }

  return { subtotal, orderItems };
}

const orderBLL = {

  placeOrderFromCart: async (userId, payload) => {
    const { address_id, currency } = payload;

    if (!address_id || !currency) {
      const err = new Error('address_id e currency são obrigatórios');
      err.status = 400;
      throw err;
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const cartItems = await orderDAL.getCartItemsByUser(userId, conn);

      if (!cartItems || cartItems.length === 0) {
        const err = new Error('Carrinho vazio');
        err.status = 400;
        throw err;
      }

      const { subtotal, orderItems } = await buildOrderItemsWithStockValidation(cartItems, conn);
      const total = subtotal;
      const order_number = generateOrderNumber();

      const orderResult = await orderDAL.createOrder({
        user_id: userId,
        address_id,
        order_number,
        status: 'PENDING',
        currency,
        subtotal,
        discount_total: 0,
        shipping_total: 0,
        total
      }, conn);

      const orderId = orderResult.insertId;

      for (const it of orderItems) {
        await orderDAL.addOrderItem({ ...it, order_id: orderId }, conn);
        const stockResult = await inventoryDAL.decrementStock({
          variant_id: it.variant_id,
          quantity: it.quantity
        }, conn);

        if (stockResult.affectedRows !== 1) {
          throw createOutOfStockError({
            snap: it,
            variantId: it.variant_id,
            requested: it.quantity,
            available: 0
          });
        }
      }

      await orderDAL.clearCart(userId, conn);

      const createdOrder = await orderDAL.getOrderById(orderId, conn);
      const createdItems = formatOrderItems(await orderDAL.listOrderItems(orderId, conn));

      await conn.commit();
      return { ...createdOrder, items: createdItems };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  create: async (userId, payload) => {
    const { address_id, currency, items, notes, discount_total, shipping_total } = payload;

    if (!address_id || !currency || !Array.isArray(items) || items.length === 0) {
      const err = new Error('address_id, currency e items são obrigatórios');
      err.status = 400;
      throw err;
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const { subtotal, orderItems } = await buildOrderItemsWithStockValidation(items, conn);
      const discount = Number(discount_total || 0);
      const shipping = Number(shipping_total || 0);
      const total = subtotal - discount + shipping;
      const order_number = generateOrderNumber();

      const orderResult = await orderDAL.createOrder({
        user_id: userId || null,
        address_id,
        order_number,
        status: 'PENDING',
        currency,
        subtotal,
        discount_total: discount,
        shipping_total: shipping,
        total,
        notes
      }, conn);

      const orderId = orderResult.insertId;

      for (const it of orderItems) {
        await orderDAL.addOrderItem({ ...it, order_id: orderId }, conn);
        const stockResult = await inventoryDAL.decrementStock({
          variant_id: it.variant_id,
          quantity: it.quantity
        }, conn);

        if (stockResult.affectedRows !== 1) {
          throw createOutOfStockError({
            snap: it,
            variantId: it.variant_id,
            requested: it.quantity,
            available: 0
          });
        }
      }

      const createdOrder = await orderDAL.getOrderById(orderId, conn);
      const createdItems = formatOrderItems(await orderDAL.listOrderItems(orderId, conn));

      await conn.commit();
      return { ...createdOrder, items: createdItems };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  getById: async (id) => {
    const order = await orderDAL.getOrderById(id);
    if (!order) return null;
    const items = formatOrderItems(await orderDAL.listOrderItems(id));
    return { ...order, items };
  },

  getByNumber: async (orderNumber, user) => {
    const order = await orderDAL.getOrderByNumber(orderNumber);

    if (!order) {
      const err = new Error('Pedido não encontrado');
      err.status = 404;
      throw err;
    }

    if (Number(order.user_id) !== Number(user.id)) {
      const err = new Error('Sem permissão para visualizar este pedido');
      err.status = 403;
      throw err;
    }

    const items = formatOrderItems(await orderDAL.listOrderItems(order.id));
    return { ...formatOrderWithAddress(order), items };
  },

  cancel: async (id, user) => {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const order = await orderDAL.getOrderByIdForUpdate(id, conn);

      if (!order) {
        const err = new Error('Pedido não encontrado');
        err.status = 404;
        throw err;
      }

      const isAdmin = user.role === 'ADMIN';
      const isOwner = Number(order.user_id) === Number(user.id);

      if (!isAdmin && !isOwner) {
        const err = new Error('Sem permissão para cancelar este pedido');
        err.status = 403;
        throw err;
      }

      if (NON_CANCELABLE_STATUSES.includes(order.status)) {
        const err = new Error(`Pedido não pode ser cancelado com status ${order.status}`);
        err.status = 400;
        err.details = {
          code: 'ORDER_STATUS_NOT_CANCELABLE',
          order_id: Number(order.id),
          status: order.status
        };
        throw err;
      }

      const items = await orderDAL.listOrderItems(id, conn);

      for (const item of items) {
        await inventoryDAL.incrementStock({
          variant_id: item.variant_id,
          quantity: item.quantity
        }, conn);
      }

      await orderDAL.updateOrderStatus(id, 'CANCELLED', conn);

      const canceledOrder = await orderDAL.getOrderById(id, conn);
      const canceledItems = formatOrderItems(await orderDAL.listOrderItems(id, conn));

      await conn.commit();
      return { ...canceledOrder, items: canceledItems };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  listMy: async (userId) => {
    const orders = await orderDAL.listMyOrders(userId);

    return Promise.all(orders.map(async (order) => {
      const items = formatOrderItems(await orderDAL.listOrderItems(order.id));
      return {
        ...order,
        items_preview: items.slice(0, 4),
        items_count: items.length
      };
    }));
  }
};

module.exports = orderBLL;
