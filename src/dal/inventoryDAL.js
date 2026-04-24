const { pool } = require('../config/dbConfig');

const inventoryDAL = {
    getByVariantId: async (variantId, db = pool) => {
        const [rows] = await db.query(
            `SELECT * FROM inventory WHERE variant_id = ?`,
            [variantId]
        );
        return rows[0] || null;
    },

    getByVariantIdForUpdate: async (variantId, db = pool) => {
        const [rows] = await db.query(
            `SELECT * FROM inventory WHERE variant_id = ? FOR UPDATE`,
            [variantId]
        );
        return rows[0] || null;
    },

    decrementStock: async ({ variant_id, quantity }, db = pool) => {
        const [result] = await db.query(
            `UPDATE inventory
             SET quantity = quantity - ?
             WHERE variant_id = ?
               AND quantity >= ?`,
            [quantity, variant_id, quantity]
        );
        return result;
    },

    incrementStock: async ({ variant_id, quantity }, db = pool) => {
        const [result] = await db.query(
            `INSERT INTO inventory (variant_id, quantity, low_stock_threshold, updated_at)
             VALUES (?, ?, 0, NOW())
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()`,
            [variant_id, quantity]
        );
        return result;
    }
};

module.exports = inventoryDAL;
