const mongoose = require('mongoose');
const Result = require('../models/Result');
const User = require('../models/User');

// @desc    Submit test result
// @route   POST /api/results/submit
// @access  Private
const submitResult = async (req, res) => {
    const { testId, totalQuestions, timeTaken, answers, warnings, status, malpracticeReason } = req.body;

    let calculatedScore = 0;
    if (answers && Array.isArray(answers)) {
        answers.forEach((ans) => {
            const isSkipped = ans.selectedOption === null || 
                              ans.selectedOption === undefined || 
                              ans.selectedOption === -1 || 
                              (Array.isArray(ans.selectedOption) && ans.selectedOption.length === 0) || 
                              (typeof ans.selectedOption === 'object' && ans.selectedOption !== null && !Array.isArray(ans.selectedOption) && Object.keys(ans.selectedOption).length === 0);
            
            if (isSkipped) {
                // skipped
            } else if (ans.isCorrect) {
                calculatedScore += 4;
            } else {
                calculatedScore -= 1;
            }
        });
    }

    // Enforce max 2 attempts per test
    const existingAttempts = await Result.countDocuments({
        userId: req.user._id,
        testId,
    });

    if (existingAttempts >= 2) {
        return res.status(403).json({
            message: 'Not allowed. Max 2 attempts are permitted for this test.'
        });
    }

    const result = new Result({
        userId: req.user._id,
        testId,
        score: calculatedScore,
        totalQuestions,
        timeTaken,
        answers,
        warnings,
        status: status || 'completed',
        malpracticeReason,
    });

    const createdResult = await result.save();

    // Update user stats
    const user = await User.findById(req.user._id);
    const results = await Result.find({ userId: req.user._id });
    
    user.stats.totalTests = results.length;
    user.stats.totalTime += timeTaken;
    user.stats.averageScore = results.reduce((acc, item) => acc + item.score, 0) / results.length;
    
    await user.save();

    res.status(201).json(createdResult);
};

// @desc    Get user results
// @route   GET /api/results/me
// @access  Private
const getMyResults = async (req, res) => {
    const results = await Result.find({ userId: req.user._id }).populate('testId', 'title category');
    res.json(results);
};

// @desc    Get result by ID
// @route   GET /api/results/:id
// @access  Private
const getResultById = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid Result ID');
    }

    const result = await Result.findById(req.params.id)
        .populate('testId', 'title category duration')
        .populate({
            path: 'answers.questionId',
            select: 'text image options correctAnswer explanation'
        });

    if (result && (result.userId.toString() === req.user._id.toString() || req.user.role === 'admin')) {
        // Calculate session metrics
        let correct = 0;
        let incorrect = 0;
        let skipped = 0;

        result.answers.forEach((ans) => {
            const isSkipped = ans.selectedOption === null || 
                              ans.selectedOption === undefined || 
                              ans.selectedOption === -1 || 
                              (Array.isArray(ans.selectedOption) && ans.selectedOption.length === 0) || 
                              (typeof ans.selectedOption === 'object' && ans.selectedOption !== null && !Array.isArray(ans.selectedOption) && Object.keys(ans.selectedOption).length === 0);

            if (isSkipped) {
                skipped++;
            } else if (ans.isCorrect) {
                correct++;
            } else {
                incorrect++;
            }
        });

        const accuracyRate = (correct / result.totalQuestions) * 100;
        const confidenceIndex = (correct / (correct + incorrect || 1)) * 100;

        // Return result with session summary
        res.json({
            ...result._doc,
            sessionSummary: {
                masteryScore: result.score,
                accuracyRate: Math.round(accuracyRate),
                confidenceIndex: Math.round(confidenceIndex),
                correctAnswers: correct,
                incorrectAnswers: incorrect,
                skippedAnswers: skipped,
                timeOnTask: result.timeTaken
            }
        });
    } else {
        res.status(404);
        throw new Error('Result not found or unauthorized');
    }
};

// @desc    Get aggregated student stats
// @route   GET /api/results/stats
// @access  Private
const getStudentStats = async (req, res) => {
    const results = await Result.find({ userId: req.user._id }).populate('testId', 'title category');

    if (!results || results.length === 0) {
        return res.json({
            totalTests: 0,
            masteryScore: 0,
            accuracyRate: 0,
            confidenceIndex: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalSkipped: 0,
            totalTime: 0,
        });
    }

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalSkipped = 0;
    let totalQuestions = 0;
    let totalScore = 0;
    let totalTime = 0;

    results.forEach((result) => {
        totalScore += result.score;
        totalQuestions += result.totalQuestions;
        totalTime += result.timeTaken;

        result.answers.forEach((ans) => {
            const isSkipped = ans.selectedOption === null || 
                              ans.selectedOption === undefined || 
                              ans.selectedOption === -1 || 
                              (Array.isArray(ans.selectedOption) && ans.selectedOption.length === 0) || 
                              (typeof ans.selectedOption === 'object' && ans.selectedOption !== null && !Array.isArray(ans.selectedOption) && Object.keys(ans.selectedOption).length === 0);

            if (isSkipped) {
                totalSkipped++;
            } else if (ans.isCorrect) {
                totalCorrect++;
            } else {
                totalIncorrect++;
            }
        });
    });

    const totalTests = results.length;
    const accuracyRate = (totalCorrect / totalQuestions) * 100;
    const masteryScore = totalScore / totalTests;
    const confidenceIndex = (totalCorrect / (totalCorrect + totalIncorrect || 1)) * 100;

    // Get unique list of tests attempted with their latest scores
    const attemptedTests = results.map(r => ({
        resultId: r._id,
        testId: r.testId._id,
        title: r.testId.title,
        category: r.testId.category,
        score: r.score,
        status: r.status,
        malpracticeReason: r.malpracticeReason,
        date: r.createdAt
    }));

    res.json({
        totalTests,
        masteryScore: Math.round(masteryScore),
        accuracyRate: Math.round(accuracyRate),
        confidenceIndex: Math.round(confidenceIndex),
        totalCorrect,
        totalIncorrect,
        totalSkipped,
        totalTime,
        attemptedTests
    });
};

// @desc    Report malpractice and terminate test
// @route   POST /api/results/report-malpractice
// @access  Private
const reportMalpractice = async (req, res) => {
    const { testId, reason, timeTaken, totalQuestions } = req.body;

    // Enforce max 2 attempts per test
    const existingAttempts = await Result.countDocuments({
        userId: req.user._id,
        testId,
    });

    if (existingAttempts >= 2) {
        return res.status(403).json({
            message: 'Not allowed. Max 2 attempts are permitted for this test.'
        });
    }

    const result = new Result({
        userId: req.user._id,
        testId,
        score: 0,
        totalQuestions: totalQuestions || 0,
        timeTaken: timeTaken || 0,
        answers: [],
        status: 'malpractice',
        malpracticeReason: reason || 'Suspicious activity detected',
    });


    const createdResult = await result.save();

    // Update user stats (increment total tests, but average score will drop)
    const user = await User.findById(req.user._id);
    const results = await Result.find({ userId: req.user._id });
    
    user.stats.totalTests = results.length;
    user.stats.averageScore = results.reduce((acc, item) => acc + item.score, 0) / results.length;
    
    await user.save();

    res.status(201).json({
        message: 'Test terminated due to malpractice',
        resultId: createdResult._id
    });
};

module.exports = { submitResult, getMyResults, getResultById, getStudentStats, reportMalpractice };
