const express = require('express');
const {
    getTests,
    getTestById,
    getTestQuestions,
    createTest,
    addQuestionToTest,
} = require('../controllers/testController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').get(getTests).post(protect, admin, createTest);
router.route('/:id').get(getTestById);
router.route('/:id/questions').get(protect, getTestQuestions).post(protect, admin, addQuestionToTest);

module.exports = router;
