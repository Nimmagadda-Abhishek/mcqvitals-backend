const express = require('express');
const { createOrder, verifyPayment, getSubscriptionHistory, cancelSubscription, upgradeSubscription, getSubscriptionPlans } = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/plans').get(protect, getSubscriptionPlans);
router.route('/order').post(protect, createOrder);
router.route('/verify').post(protect, verifyPayment);
router.route('/history').get(protect, getSubscriptionHistory);
router.route('/cancel').post(protect, cancelSubscription);
router.route('/upgrade').post(protect, upgradeSubscription);

module.exports = router;
