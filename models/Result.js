const mongoose = require('mongoose');

const resultSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        testId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Test',
        },
        score: {
            type: Number,
            required: true,
        },
        totalQuestions: {
            type: Number,
            required: true,
        },
        timeTaken: {
            type: Number, // in seconds
            required: true,
        },
        answers: [
            {
                questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
                selectedOption: mongoose.Schema.Types.Mixed,
                isCorrect: Boolean,
            },
        ],
        warnings: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['completed', 'malpractice', 'terminated'],
            default: 'completed'
        },
        malpracticeReason: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;
