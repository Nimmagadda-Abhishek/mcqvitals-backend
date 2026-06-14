const mongoose = require('mongoose');

const questionSchema = mongoose.Schema(
    {
        testId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Test',
        },
        text: {
            type: String,
            required: true,
        },
        images: [{ type: String }],
        questionType: {
            type: String,
            enum: ['single', 'true_false_matrix', 'multiple_choice'],
            default: 'single'
        },
        options: [
            {
                text: { type: String, required: true },
                images: [{ type: String }],
            },
        ],
        trueFalseAnswers: {
            type: [Boolean], // Used for true_false_matrix
        },
        multipleCorrectAnswers: {
            type: [Number], // Used for multiple_choice
        },
        correctAnswer: {
            type: Number, // Index of the correct option
            required: function() {
                return this.questionType === 'single';
            },
        },
        explanation: {
            text: { type: String, default: '' },
            images: [{ type: String }],
        },
    },
    {
        timestamps: true,
    }
);

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
