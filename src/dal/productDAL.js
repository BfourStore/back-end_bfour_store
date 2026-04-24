const { pool } = require('../config/dbConfig');

// Helpers para o front (template do e-commerce)
function mapRowToStoreProduct(row) {
    if (!row) return null;

    const department = row.parent_category_name || row.category_name || "Shop";
    const category = row.category_name || department;

    const stockQty = row.stock_qty != null ? Number(row.stock_qty) : 0;

    // images_json vem do SELECT com JSON_ARRAYAGG
    let images = [];
    try {
        if (row.images_json) {
            const parsed = typeof row.images_json === "string"
                ? JSON.parse(row.images_json)
                : row.images_json; // caso o driver já entregue parseado
            if (Array.isArray(parsed)) images = parsed.filter(Boolean);
        }
    } catch (e) {
        images = [];
    }

    const imagePath = row.image_url || "";

    // fallback: se não tiver galeria, pelo menos a capa vira 1 item
    if (images.length === 0 && imagePath) {
        images = [imagePath];
    }

    // remove duplicados (mantém ordem)
    images = Array.from(new Set(images));

    return {
        _id: String(row.variant_id),
        title: row.product_name,
        department,
        category,
        price: Number(row.price),
        imagePath,
        images,
        description: row.description || "",
        color: row.color || "",
        size: row.size || "",
        sku: row.sku,
        compareAtPrice: row.compare_at_price != null ? Number(row.compare_at_price) : null,
        shippingPrice: row.shipping_price != null ? Number(row.shipping_price) : null,
        stockQty,
        inStock: stockQty > 0,
    };
}


const productDAL = {
  createProduct: async (p) => {
    const [result] = await pool.query(
        `INSERT INTO products (category_id, name, slug, description, brand, shipping_price, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          p.category_id || null,
          p.name,
          p.slug,
          p.description || null,
          p.brand || null,
          p.shipping_price ?? null,
          p.is_active ? 1 : 0
        ]
    );
    return result;
  },

  updateProduct: async (id, p) => {
    const [result] = await pool.query(
        `UPDATE products
 SET category_id=?, name=?, slug=?, description=?, brand=?, shipping_price=?, is_active=?, updated_at=NOW() WHERE id=?`,
        [
          p.category_id || null,
          p.name,
          p.slug,
          p.description || null,
          p.brand || null,
          p.shipping_price ?? null,
          p.is_active ? 1 : 0,
          id
        ]
    );
    return result;
  },

  deleteProduct: async (id) => {
    const [result] = await pool.query(`DELETE FROM products WHERE id=?`, [id]);
    return result;
  },

  getProductById: async (id) => {
    const [rows] = await pool.query(`SELECT * FROM products WHERE id=?`, [id]);
    return rows[0] || null;
  },

  listProducts: async () => {
    const [rows] = await pool.query(`SELECT * FROM products ORDER BY id DESC`);
    return rows;
  },

  addImage: async ({ product_id, image_url, sort_order, is_cover }) => {
    const [result] = await pool.query(
      `INSERT INTO product_images (product_id, image_url, sort_order, is_cover, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [product_id, image_url, Number(sort_order || 0), is_cover ? 1 : 0]
    );
    return result;
  },

  addVariant: async (v) => {
    const [result] = await pool.query(
      `INSERT INTO product_variants
       (product_id, sku, color, size, price, compare_at_price, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [v.product_id, v.sku, v.color || null, v.size || null, v.price, v.compare_at_price || null, v.is_active ? 1 : 0]
    );
    return result;
  },

  upsertInventory: async ({ variant_id, quantity, low_stock_threshold }) => {
    const [result] = await pool.query(
      `INSERT INTO inventory (variant_id, quantity, low_stock_threshold, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE quantity=VALUES(quantity), low_stock_threshold=VALUES(low_stock_threshold), updated_at=NOW()`,
      [variant_id, Number(quantity || 0), Number(low_stock_threshold || 0)]
    );
    return result;
  }
  ,
    listRecommendedByVariantId: async (variantId, limit = 8) => {
        const [rows] = await pool.query(
            `SELECT
        v2.id                    AS variant_id,
        v2.sku                   AS sku,
        v2.color                 AS color,
        v2.size                  AS size,
        v2.price                 AS price,
        v2.compare_at_price      AS compare_at_price,
        p.name                   AS product_name,
        p.description            AS description,
        c.name                   AS category_name,
        p.shipping_price         AS shipping_price,
        pc.name                  AS parent_category_name,

        COALESCE(
          (SELECT i.image_url
           FROM product_images i
           WHERE i.variant_id = v2.id
           ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
           LIMIT 1),
          (SELECT i.image_url
           FROM product_images i
           WHERE i.product_id = p.id AND (i.variant_id IS NULL)
           ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
           LIMIT 1)
        ) AS image_url

     FROM variant_recommendations r
     JOIN product_variants v2 ON v2.id = r.recommended_variant_id
     JOIN products p ON p.id = v2.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE r.variant_id = ?
       AND r.active = 1
       AND v2.is_active = 1
       AND p.is_active = 1
     ORDER BY r.sort_order ASC, r.id ASC
     LIMIT ?`,
            [Number(variantId), Number(limit)]
        );

        return rows.map(mapRowToStoreProduct);
    },

  // ---------------------------------------------------------------------------
  // Storefront (front-end template)
  // Retorna uma lista achatada por VARIANT (cada _id é um variant_id)
  // ---------------------------------------------------------------------------
  listStoreProducts: async () => {
    const [rows] = await pool.query(
      `SELECT
          v.id                    AS variant_id,
          v.sku                   AS sku,
          v.color                 AS color,
          v.size                  AS size,
          v.price                 AS price,
          v.compare_at_price      AS compare_at_price,
          p.name                  AS product_name,
          p.description           AS description,
          c.name                  AS category_name,
          p.shipping_price AS shipping_price,
          pc.name                 AS parent_category_name,
       COALESCE(
  (SELECT i.image_url
   FROM product_images i
   WHERE i.variant_id = v.id
   ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
   LIMIT 1),
  (SELECT i.image_url
   FROM product_images i
   WHERE i.product_id = p.id AND (i.variant_id IS NULL)
   ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
   LIMIT 1)
) AS image_url
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN categories pc ON pc.id = c.parent_id
        WHERE v.is_active = 1 AND p.is_active = 1
        ORDER BY v.id DESC`
    );
    return rows.map(mapRowToStoreProduct);
  },

    getStoreProductByVariantId: async (variantId) => {
        const [rows] = await pool.query(
            `SELECT
                 v.id AS variant_id,
                 v.product_id AS product_id,
                 v.sku AS sku,
                 v.color AS color,
                 v.size AS size,
  v.price AS price,
  v.compare_at_price AS compare_at_price,
  p.name AS product_name,
  p.description AS description,
  p.shipping_price AS shipping_price,
  c.name AS category_name,
  pc.name AS parent_category_name,
  COALESCE(inv.quantity, 0) AS stock_qty,

  -- imagem principal (mantém como está)
  COALESCE(
    (SELECT i.image_url
     FROM product_images i
     WHERE i.variant_id = v.id
     ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
     LIMIT 1),
    (SELECT i.image_url
     FROM product_images i
     WHERE i.product_id = p.id AND i.variant_id IS NULL
     ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
     LIMIT 1)
  ) AS image_url,

  -- galeria (variant primeiro; se não tiver, cai pro produto)
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(x.image_url)
      FROM (
        SELECT i.image_url
        FROM product_images i
        WHERE i.variant_id = v.id
        ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
      ) x
    ),
    (
      SELECT JSON_ARRAYAGG(x.image_url)
      FROM (
        SELECT i.image_url
        FROM product_images i
        WHERE i.product_id = p.id AND i.variant_id IS NULL
        ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
      ) x
    )
  ) AS images_json

             FROM product_variants v
                 JOIN products p ON p.id = v.product_id
                 LEFT JOIN categories c ON c.id = p.category_id
                 LEFT JOIN categories pc ON pc.id = c.parent_id
                 LEFT JOIN inventory inv ON inv.variant_id = v.id
             WHERE v.id = ?
                 LIMIT 1;`,
            [variantId]
        );

        return mapRowToStoreProduct(rows[0] || null);
    },


    resolveProductIdFromVariant: async (variantId) => {
    const [rows] = await pool.query(`SELECT product_id FROM product_variants WHERE id = ? LIMIT 1`, [variantId]);
    return rows[0]?.product_id || null;
  },

  listStoreVariantsByProductId: async (productId) => {
    const [rows] = await pool.query(
      `SELECT
          v.id               AS variant_id,
          v.sku              AS sku,
          v.color            AS color,
          v.size             AS size,
          v.price            AS price,
          v.compare_at_price AS compare_at_price,
          p.name             AS product_name,
          p.description      AS description,
          p.shipping_price AS shipping_price,
          c.name             AS category_name,
          pc.name            AS parent_category_name,
        COALESCE(
  (SELECT i.image_url
   FROM product_images i
   WHERE i.variant_id = v.id
   ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
   LIMIT 1),
  (SELECT i.image_url
   FROM product_images i
   WHERE i.product_id = p.id AND (i.variant_id IS NULL)
   ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
   LIMIT 1)
) AS image_url
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN categories pc ON pc.id = c.parent_id
        WHERE v.product_id = ? AND v.is_active = 1 AND p.is_active = 1
        ORDER BY v.id DESC`,
      [productId]
    );
    return rows.map(mapRowToStoreProduct);
  },

  // aceita tanto variantId quanto productId (o template passa "productId" mas na prática vem variantId)
  listStoreVariantsByProductOrVariantId: async (rawId) => {
    const asNumber = Number(rawId);
    const looksNumeric = Number.isFinite(asNumber) && String(asNumber) === String(rawId);

    // Se vier um variant_id, resolve o product_id.
    if (looksNumeric) {
      const productId = await productDAL.resolveProductIdFromVariant(asNumber);
      if (productId) return productDAL.listStoreVariantsByProductId(productId);
      // fallback: pode ser product_id
      return productDAL.listStoreVariantsByProductId(asNumber);
    }
    // Se não for numérico, não dá pra resolver no nosso modelo atual.
    return [];
  }
};

module.exports = productDAL;
