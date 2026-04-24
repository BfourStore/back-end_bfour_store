const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

/* ===========================
   Público
=========================== */

// Lista todos
router.get('/', productController.list);

// 🔥 IMPORTANTE: rota específica deve vir antes de '/:id'
router.get('/:id/recommendations', productController.getRecommendations);

// Busca produto por variantId
router.get('/:id', productController.getById);


/* ===========================
   Admin
=========================== */

router.post('/', authMiddleware, requireRole('ADMIN'), productController.create);
router.put('/:id', authMiddleware, requireRole('ADMIN'), productController.update);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), productController.delete);


/* ===========================
   Sub-recursos
=========================== */

router.post('/:id/images', authMiddleware, requireRole('ADMIN'), productController.addImage);
router.post('/:id/variants', authMiddleware, requireRole('ADMIN'), productController.addVariant);
router.patch('/variants/:variantId/inventory', authMiddleware, requireRole('ADMIN'), productController.updateInventory);


module.exports = router;