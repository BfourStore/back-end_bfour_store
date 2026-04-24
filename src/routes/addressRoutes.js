const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, addressController.create);
router.get('/me', authMiddleware, addressController.listMy);
router.put('/:id', authMiddleware, addressController.update);
router.delete('/:id', authMiddleware, addressController.delete);

module.exports = router;
