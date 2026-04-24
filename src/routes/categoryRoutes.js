const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

router.get('/', categoryController.list);

// Admin
router.post('/', authMiddleware, requireRole('ADMIN'), categoryController.create);
router.put('/:id', authMiddleware, requireRole('ADMIN'), categoryController.update);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), categoryController.delete);

module.exports = router;
