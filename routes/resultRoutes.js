const express = require('express');
const { submitResult, getMyResults, getResultById, getStudentStats, reportMalpractice } = require('../controllers/resultController');
const { protect } = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');


const router = express.Router();

router.post('/submit', protect, requireApproved, submitResult);
router.post('/report-malpractice', protect, requireApproved, reportMalpractice);
router.get('/me', protect, requireApproved, getMyResults);
router.get('/stats', protect, requireApproved, getStudentStats);
router.get('/:id', protect, requireApproved, getResultById);


module.exports = router;
