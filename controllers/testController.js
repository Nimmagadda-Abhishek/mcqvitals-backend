const Test = require('../models/Test');
const Question = require('../models/Question');

// @desc    Fetch all tests
// @route   GET /api/tests
// @access  Public
const getTests = async (req, res) => {
    const tests = await Test.find({});
    res.json(tests);
};

// @desc    Fetch single test
// @route   GET /api/tests/:id
// @access  Public
const getTestById = async (req, res) => {
    const test = await Test.findById(req.params.id).populate('questions');

    if (test) {
        res.json(test);
    } else {
        res.status(404);
        throw new Error('Test not found');
    }
};

// @desc    Get questions for a test
// @route   GET /api/tests/:id/questions
// @access  Private
const getTestQuestions = async (req, res) => {
    const questions = await Question.find({ testId: req.params.id });
    res.json(questions);
};

// @desc    Create a test
// @route   POST /api/tests
// @access  Private/Admin
const createTest = async (req, res) => {
    const { title, description, category, duration, difficulty, price, isFree } = req.body;

    const test = new Test({
        title,
        description,
        category,
        duration,
        difficulty,
        price,
        isFree: isFree !== undefined ? isFree : true,
    });

    const createdTest = await test.save();
    res.status(201).json(createdTest);
};

// @desc    Add question to test
// @route   POST /api/tests/:id/questions
// @access  Private/Admin
const addQuestionToTest = async (req, res) => {
    const { text, image, options, correctAnswer, explanation } = req.body;
    const testId = req.params.id;

    // Transform options if they are just strings
    const formattedOptions = options.map(opt => 
        typeof opt === 'string' ? { text: opt, image: '' } : opt
    );

    // Transform explanation if it's just a string
    const formattedExplanation = typeof explanation === 'string' 
        ? { text: explanation, image: '' } 
        : explanation;

    const test = await Test.findById(testId);
    if (!test) {
        return res.status(404).json({ message: 'Test not found' });
    }

    const trimmedText = text.trim();
    const textRegex = new RegExp(`^\\s*${trimmedText.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$`, 'i');
    const existingQuestion = await Question.findOne({ testId, text: textRegex });
    if (existingQuestion) {
        return res.status(400).json({ message: 'This question already exists in the module' });
    }

    const question = new Question({
        testId,
        text: trimmedText,
        image: image || '',
        options: formattedOptions,
        correctAnswer,
        explanation: formattedExplanation,
    });

    const createdQuestion = await question.save();
    test.questions.push(createdQuestion._id);
    await test.save();

    res.status(201).json(createdQuestion);
};

module.exports = {
    getTests,
    getTestById,
    getTestQuestions,
    createTest,
    addQuestionToTest,
};
