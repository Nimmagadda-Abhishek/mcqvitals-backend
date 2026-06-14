const express = require('express');
const { logViolation, getViolations } = require('../controllers/violationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/log-violation', protect, logViolation);
router.get('/violations/:userId/:testId', protect, getViolations);

module.exports = router;
