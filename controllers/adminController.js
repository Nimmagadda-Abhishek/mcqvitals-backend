
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Result = require('../models/Result');
const Resource = require('../models/Resource');
const SubscriptionOrder = require('../models/SubscriptionOrder');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTests = await Test.countDocuments();
    const totalQuestions = await Question.countDocuments();
    const totalResults = await Result.countDocuments();
    const malpracticeCount = await Result.countDocuments({ status: 'malpractice' });

    const avgScoreData = await Result.aggregate([
        { $group: { _id: null, avgScore: { $avg: "$score" } } }
    ]);
    const averageScore = avgScoreData.length > 0 ? avgScoreData[0].avgScore : 0;

    const recentResults = await Result.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name email')
        .populate('testId', 'title category');

    const categoryStats = await Result.aggregate([
        { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
        { $unwind: '$test' },
        { $group: { _id: "$test.category", count: { $sum: 1 } } },
        { $project: { category: "$_id", count: 1, _id: 0 } }
    ]);

    const activeSubscribers = await User.countDocuments({ 'subscription.status': 'active' });
    const earningsData = await SubscriptionOrder.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, totalEarnings: { $sum: "$amount" } } }
    ]);
    const totalSubscriptionEarnings = earningsData.length > 0 ? earningsData[0].totalEarnings : 0;

    res.json({
        totalStudents,
        totalTests,
        totalQuestions,
        totalResults,
        malpracticeCount,
        averageScore: Math.round(averageScore),
        activeSubscribers,
        totalSubscriptionEarnings,
        recentResults,
        categoryStats
    });
};

// @desc    Get all students
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    const users = await User.find({ role: 'student' }).select('-password').sort({ createdAt: -1 });
    res.json(users);
};

// @desc    Get pending device change requests
// @route   GET /api/admin/device-change-requests
// @access  Private/Admin
const getDeviceChangeRequests = async (req, res) => {
    const users = await User.find({ deviceChangeRequested: true }).select('-password');
    res.json(users);
};

// @desc    Approve device change request
// @route   POST /api/admin/device-change-requests/:id/approve
// @access  Private/Admin
const approveDeviceChange = async (req, res) => {
    const user = await User.findById(req.params.id);
    
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    user.deviceId = null;
    user.deviceChangeRequested = false;
    await user.save();

    res.json({ message: 'Device change request approved successfully' });
};

// @desc    Get all test results
// @route   GET /api/admin/results
// @access  Private/Admin
const getAllResults = async (req, res) => {
    const results = await Result.find()
        .sort({ createdAt: -1 })
        .populate('userId', 'name email profileImage')
        .populate('testId', 'title category');
    res.json(results);
};

// @desc    Get all subscriptions
// @route   GET /api/admin/subscriptions
// @access  Private/Admin
const getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await SubscriptionOrder.find({ status: { $ne: 'created' } })
            .sort({ createdAt: -1 })
            .populate('userId', 'name email profileImage');
        res.json(subscriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new test
// @route   POST /api/admin/tests
// @access  Private/Admin
const createTest = async (req, res) => {
    const { title, description, category, duration, difficulty, rating, isFree } = req.body;
    const test = await Test.create({
        title,
        description,
        category,
        duration,
        difficulty,
        rating: rating || 5,
        isFree: isFree !== undefined ? isFree : true,
        createdBy: req.user._id
    });
    res.status(201).json(test);
};

// @desc    Add question to test
// @route   POST /api/admin/tests/:testId/questions
// @access  Private/Admin
const addQuestionToTest = async (req, res) => {
    try {
        const { text, images, options, correctAnswer, explanation, questionType, trueFalseAnswers, multipleCorrectAnswers } = req.body;
        const testId = req.params.testId;

        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const trimmedText = text.trim();
        // Check for duplicate question in the same module
        const textRegex = new RegExp(`^\\s*${trimmedText.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$`, 'i');
        const existingQuestion = await Question.findOne({ testId, text: textRegex });
        if (existingQuestion) {
            return res.status(400).json({ message: 'This question already exists in the module' });
        }

        // Transform options if they are just strings
        const formattedOptions = options.map(opt => 
            typeof opt === 'string' ? { text: opt, images: [] } : { text: opt.text, images: opt.images || [] }
        );

        // Transform explanation if it's just a string
        const formattedExplanation = typeof explanation === 'string' 
            ? { text: explanation, images: [] } 
            : { text: explanation.text, images: explanation.images || [] };

        const question = await Question.create({
            testId,
            text: trimmedText,
            images: images || [],
            options: formattedOptions,
            correctAnswer,
            explanation: formattedExplanation,
            questionType: questionType || 'single',
            trueFalseAnswers: trueFalseAnswers || [],
            multipleCorrectAnswers: multipleCorrectAnswers || []
        });

        // Update Test questions array
        test.questions.push(question._id);
        await test.save();

        res.status(201).json(question);
    } catch (error) {
        console.error('Add Question Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get test by ID
// @route   GET /api/admin/tests/:id
// @access  Private/Admin
const getTestById = async (req, res) => {
    try {
        const test = await Test.findById(req.params.id).populate('questions');
        if (test) {
            res.json(test);
        } else {
            res.status(404).json({ message: 'Test not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a test
// @route   PUT /api/admin/tests/:id
// @access  Private/Admin
const updateTest = async (req, res) => {
    try {
        const { title, description, category, duration, difficulty, rating, isFree } = req.body;
        const test = await Test.findById(req.params.id);

        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        test.title = title || test.title;
        test.description = description || test.description;
        test.category = category || test.category;
        test.duration = duration || test.duration;
        test.difficulty = difficulty || test.difficulty;
        if (rating !== undefined) test.rating = rating;
        if (isFree !== undefined) test.isFree = isFree;

        const updatedTest = await test.save();
        res.json(updatedTest);
    } catch (error) {
        console.error('Update Test Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a test
// @route   DELETE /api/admin/tests/:id
// @access  Private/Admin
const deleteTest = async (req, res) => {
    const test = await Test.findById(req.params.id);
    if (test) {
        await Question.deleteMany({ testId: test._id });
        await test.deleteOne();
        res.json({ message: 'Test and associated questions removed' });
    } else {
        res.status(404).json({ message: 'Test not found' });
    }
};

// @desc    Create study resource
// @route   POST /api/admin/resources
// @access  Private/Admin
const createResource = async (req, res) => {
    const { title, type, url, category, isFree } = req.body;
    const resource = await Resource.create({
        title,
        type,
        url,
        category,
        isFree: isFree !== undefined ? isFree : true,
        uploadedBy: req.user._id
    });
    res.status(201).json(resource);
};

// @desc    Update a question
// @route   PUT /api/admin/questions/:id
// @access  Private/Admin
const updateQuestion = async (req, res) => {
    try {
        const { text, images, options, correctAnswer, explanation, questionType, trueFalseAnswers, multipleCorrectAnswers } = req.body;
        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        // Transform options if they are just strings
        let formattedOptions = question.options;
        if (options) {
            formattedOptions = options.map(opt => 
                typeof opt === 'string' ? { text: opt, images: [] } : { text: opt.text, images: opt.images || [] }
            );
        }

        // Transform explanation if it's just a string
        let formattedExplanation = question.explanation;
        if (explanation) {
            formattedExplanation = typeof explanation === 'string' 
                ? { text: explanation, images: [] } 
                : { text: explanation.text, images: explanation.images || [] };
        }

        question.text = text !== undefined ? text : question.text;
        question.images = images !== undefined ? images : question.images;
        question.options = formattedOptions;
        question.correctAnswer = correctAnswer !== undefined ? correctAnswer : question.correctAnswer;
        question.explanation = formattedExplanation;
        if (questionType !== undefined) question.questionType = questionType;
        if (trueFalseAnswers !== undefined) question.trueFalseAnswers = trueFalseAnswers;
        if (multipleCorrectAnswers !== undefined) question.multipleCorrectAnswers = multipleCorrectAnswers;

        const updatedQuestion = await question.save();
        res.json(updatedQuestion);
    } catch (error) {
        console.error('Update Question Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a study resource
// @route   DELETE /api/admin/resources/:id
// @access  Private/Admin
const deleteResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (resource) {
            await resource.deleteOne();
            res.json({ message: 'Resource removed successfully' });
        } else {
            res.status(404).json({ message: 'Resource not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a question
// @route   DELETE /api/admin/questions/:id
// @access  Private/Admin
const deleteQuestion = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }
        
        // Remove from Test
        const test = await Test.findById(question.testId);
        if (test) {
            test.questions = test.questions.filter(id => id.toString() !== question._id.toString());
            await test.save();
        }

        await question.deleteOne();
        res.json({ message: 'Question removed successfully' });
    } catch (error) {
        console.error('Delete Question Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getAllUsers,
    getAllResults,
    getAllSubscriptions,
    createTest,
    addQuestionToTest,
    deleteTest,
    createResource,
    deleteResource,
    updateQuestion,
    deleteQuestion,
    getTestById,
    updateTest,
    getDeviceChangeRequests,
    approveDeviceChange
};
