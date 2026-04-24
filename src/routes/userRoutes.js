const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, userController.me);
router.get('/', authMiddleware, requireRole('ADMIN'), userController.list);
router.get('/:id', authMiddleware, requireRole('ADMIN'), userController.getById);
router.put('/:id', authMiddleware, requireRole('ADMIN'), userController.update);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), userController.delete);

module.exports = router;
