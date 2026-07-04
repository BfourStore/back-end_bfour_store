const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// O webhook Stripe fica em src/config/server.js para usar express.raw antes do express.json global.
router.post('/stripe/checkout-session', authMiddleware, paymentController.createStripeCheckoutSession);

// Registrar pagamento (por enquanto admin ou sistema)
router.post('/', authMiddleware, requireRole('ADMIN'), paymentController.create);
router.get('/:id', authMiddleware, requireRole('ADMIN'), paymentController.getById);

module.exports = router;
