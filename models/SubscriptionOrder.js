const mongoose = require('mongoose');

const subscriptionOrderSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        orderId: {
            type: String,
            required: true,
            unique: true,
        },
        paymentId: {
            type: String,
        },
        amount: {
            type: Number,
            required: true,
        },
        plan: {
            type: String,
            enum: ['monthly', 'yearly'],
            required: true,
        },
        status: {
            type: String,
            enum: ['created', 'paid', 'failed'],
            default: 'created',
        },
    },
    {
        timestamps: true,
    }
);

const SubscriptionOrder = mongoose.model('SubscriptionOrder', subscriptionOrderSchema);

module.exports = SubscriptionOrder;
