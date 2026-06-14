const mongoose = require('mongoose');

const violationSchema = mongoose.Schema(
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
        reason: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const Violation = mongoose.model('Violation', violationSchema);

module.exports = Violation;
