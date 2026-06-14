const mongoose = require('mongoose');

const resourceSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['document', 'image', 'video'],
        },
        url: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            required: true,
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isFree: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
    }
);

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;
