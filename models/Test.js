const mongoose = require('mongoose');

const testSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            required: true,
        },
        duration: {
            type: Number,
            required: true,
        },
        difficulty: {
            type: String,
            required: true,
            enum: ['Beginner', 'Intermediate', 'Advanced'],
        },
        price: {
            type: Number,
            default: 0,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: 5,
        },
        questions: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question'
        }],
        isFree: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
    }
);

const Test = mongoose.model('Test', testSchema);

module.exports = Test;
