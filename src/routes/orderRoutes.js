const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/place-order', authMiddleware, orderController.placeOrderFromCart);
router.post('/', authMiddleware, orderController.create);
router.get('/my', authMiddleware, orderController.listMy);
router.patch('/:id/cancel', authMiddleware, orderController.cancel);
router.get('/:id', authMiddleware, orderController.getById);

module.exports = router;
