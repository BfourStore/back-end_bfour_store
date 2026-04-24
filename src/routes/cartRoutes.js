const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/active', authMiddleware, cartController.getActive);
router.post('/active/items', authMiddleware, cartController.addItem);
router.patch('/items/:id', authMiddleware, cartController.updateItemQty);
router.delete('/items/:id', authMiddleware, cartController.deleteItem);

module.exports = router;
