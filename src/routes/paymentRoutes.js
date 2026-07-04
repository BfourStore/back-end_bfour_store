const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

router.post('/stripe/checkout-session', authMiddleware, paymentController.createStripeCheckoutSession);

// Registrar pagamento (por enquanto admin ou sistema)
router.post('/', authMiddleware, requireRole('ADMIN'), paymentController.create);
router.get('/:id', authMiddleware, requireRole('ADMIN'), paymentController.getById);

module.exports = router;
