const Violation = require('../models/Violation');
const Result = require('../models/Result');

// @desc    Log a test violation
// @route   POST /api/log-violation
// @access  Private
const logViolation = async (req, res) => {
    try {
        const { userId, testId, reason, timestamp } = req.body;

        if (!userId || !testId || !reason) {
            return res.status(400).json({ message: 'Please provide userId, testId, and reason' });
        }

        const violationDate = timestamp ? new Date(timestamp) : new Date();

        // Create the violation
        await Violation.create({
            userId,
            testId,
            reason,
            timestamp: violationDate,
        });

        // Count violations for this user and test
        const violationCount = await Violation.countDocuments({ userId, testId });

        let terminated = false;

        // If violations > 3, mark the result as terminated
        if (violationCount > 3) {
            terminated = true;
            await Result.findOneAndUpdate(
                { userId, testId },
                { 
                    status: 'terminated',
                    malpracticeReason: 'Exceeded maximum allowed violations during the test.'
                },
                { new: true }
            );
        } else {
            // Also update warnings count in the result
            await Result.findOneAndUpdate(
                { userId, testId },
                { warnings: violationCount },
                { new: true }
            );
        }

        res.status(201).json({
            success: true,
            violationCount,
            terminated,
        });
    } catch (error) {
        console.error('Log Violation Error:', error);
        res.status(500).json({ message: 'Server error while logging violation' });
    }
};

// @desc    Get all violations for a specific user and test
// @route   GET /api/violations/:userId/:testId
// @access  Private
const getViolations = async (req, res) => {
    try {
        const { userId, testId } = req.params;

        const violations = await Violation.find({ userId, testId }).sort({ timestamp: -1 });
        const totalCount = violations.length;

        const result = await Result.findOne({ userId, testId });
        const terminated = result && result.status === 'terminated';

        res.json({
            violations,
            totalCount,
            terminated: !!terminated,
        });
    } catch (error) {
        console.error('Get Violations Error:', error);
        res.status(500).json({ message: 'Server error while fetching violations' });
    }
};

module.exports = {
    logViolation,
    getViolations,
};
