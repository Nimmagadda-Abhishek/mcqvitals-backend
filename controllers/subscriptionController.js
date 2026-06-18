const crypto = require('crypto');
const Razorpay = require('razorpay');
const User = require('../models/User');
const SubscriptionOrder = require('../models/SubscriptionOrder');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_key_secret'
});

let razorpayPlansCache = { monthly: null, yearly: null };

async function getOrCreatePlan(planType) {
    if (razorpayPlansCache[planType]) return razorpayPlansCache[planType];

    const amount = planType === 'monthly' ? 299 * 100 : 1499 * 100;
    const period = planType === 'monthly' ? 'monthly' : 'yearly';
    
    try {
        const { items: plans } = await razorpay.plans.all();
        let existingPlan = plans.find(p => p.item.amount === amount && p.period === period);
        
        if (existingPlan) {
            razorpayPlansCache[planType] = existingPlan.id;
            return existingPlan.id;
        }

        const newPlan = await razorpay.plans.create({
            period,
            interval: 1,
            item: {
                name: `${planType === 'monthly' ? 'Monthly' : 'Yearly'} Pro`,
                amount,
                currency: 'INR',
                description: `${planType === 'monthly' ? 'Monthly' : 'Yearly'} Pro Subscription`
            }
        });
        
        razorpayPlansCache[planType] = newPlan.id;
        return newPlan.id;
    } catch (err) {
        console.error("Failed to fetch/create razorpay plan:", err);
        throw err;
    }
}

// @desc    Create Razorpay Order for Subscription
// @route   POST /api/subscription/order
// @access  Private
const createOrder = async (req, res) => {
    try {
        const { plan } = req.body;
        if (!['monthly', 'yearly'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan selected' });
        }

        const amount = plan === 'monthly' ? 299 * 100 : 1499 * 100; // Amount in paise

        // Mock Razorpay creation if keys are missing
        let order;
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'mock_key_id') {
            const planIdRazorpay = await getOrCreatePlan(plan);
            const options = {
                plan_id: planIdRazorpay,
                customer_notify: 1,
                total_count: plan === 'monthly' ? 120 : 10 // e.g. 10 years max
            };
            order = await razorpay.subscriptions.create(options);
        } else {
            // Mock order
            order = {
                id: `sub_mock_${Date.now()}`,
                amount,
                currency: 'INR'
            };
        }

        const subscriptionOrder = new SubscriptionOrder({
            userId: req.user._id,
            orderId: order.id,
            amount: amount / 100,
            plan
        });

        await subscriptionOrder.save();

        res.status(201).json({
            orderId: order.id, // This is now a subscription ID
            amount: amount,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID || 'mock_key_id'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating order' });
    }
};

// @desc    Verify Razorpay Payment
// @route   POST /api/subscription/verify
// @access  Private
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
        const incomingId = razorpay_subscription_id || razorpay_order_id;

        const order = await SubscriptionOrder.findOne({ orderId: incomingId });
        if (!order) {
            return res.status(404).json({ message: 'Order/Subscription not found' });
        }

        let isAuthentic = false;

        // Verify signature if we have real keys
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'mock_key_id') {
            // For subscriptions, signature is: payment_id + '|' + subscription_id
            const body = razorpay_payment_id + '|' + incomingId;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');
            isAuthentic = expectedSignature === razorpay_signature;
        } else {
            // Mock success
            isAuthentic = true;
        }

        if (isAuthentic) {
            order.status = 'paid';
            order.paymentId = razorpay_payment_id;
            await order.save();

            // Update user subscription
            const user = await User.findById(req.user._id);
            const expiryDate = new Date();
            if (plan === 'monthly') {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            } else if (plan === 'yearly') {
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            }

            user.subscription = {
                plan,
                status: 'active',
                expiryDate
            };
            await user.save();

            res.json({ message: 'Payment verified successfully' });
        } else {
            order.status = 'failed';
            await order.save();
            res.status(400).json({ message: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error verifying payment' });
    }
};

// @desc    Get User Subscription Billing History
// @route   GET /api/subscription/history
// @access  Private
const getSubscriptionHistory = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const orders = await SubscriptionOrder.find({ 
            userId: req.user._id,
            status: { $ne: 'created' }
        }).sort({ createdAt: -1 });

        const currentPlan = user.subscription?.status === 'active' ? user.subscription.plan : 'none';
        const nextBillingDate = user.subscription?.status === 'active' ? user.subscription.expiryDate : null;
        const amount = currentPlan === 'yearly' ? 1499 : (currentPlan === 'monthly' ? 299 : 0);

        res.json({
            currentPlan,
            nextBillingDate,
            amount,
            history: orders
        });
    } catch (error) {
        console.error('Fetch Subscription History Error:', error);
        res.status(500).json({ message: 'Server error fetching billing history' });
    }
};

const cancelSubscription = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        user.subscription = {
            plan: 'none',
            status: 'inactive',
            expiryDate: null
        };
        await user.save();
        
        res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error cancelling subscription' });
    }
};

// @desc    Upgrade subscription from monthly to yearly
// @route   POST /api/subscription/upgrade
// @access  Private
const upgradeSubscription = async (req, res) => {
    try {
        const { plan } = req.body;
        if (plan !== 'yearly') {
            return res.status(400).json({ message: 'Can only upgrade to a yearly plan' });
        }

        const user = await User.findById(req.user._id);
        if (user.subscription.plan !== 'monthly' || user.subscription.status !== 'active') {
            return res.status(400).json({ message: 'Only active monthly users can upgrade' });
        }

        // Calculate prorated cost
        let proratedAmount = 1499; // default yearly cost
        const now = new Date();
        if (user.subscription.expiryDate && user.subscription.expiryDate > now) {
            const timeDiff = user.subscription.expiryDate - now;
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
            // Value of remaining days on monthly plan (299 per 30 days)
            const remainingValue = (299 / 30) * daysLeft;
            proratedAmount = Math.max(0, 1499 - remainingValue);
        }

        const amountInPaise = Math.round(proratedAmount * 100);

        let order;
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'mock_key_id') {
            const planIdRazorpay = await getOrCreatePlan('yearly');
            const options = {
                plan_id: planIdRazorpay,
                customer_notify: 1,
                total_count: 10
            };
            order = await razorpay.subscriptions.create(options);
        } else {
            // Mock order
            order = {
                id: `sub_upgrade_mock_${Date.now()}`,
                amount: amountInPaise,
                currency: 'INR'
            };
        }

        const subscriptionOrder = new SubscriptionOrder({
            userId: req.user._id,
            orderId: order.id,
            amount: amountInPaise / 100,
            plan: 'yearly'
        });

        await subscriptionOrder.save();

        res.status(201).json({
            orderId: order.id,
            amount: amountInPaise,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
            isUpgrade: true
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating upgrade order' });
    }
};

// @desc    Get all subscription plans
// @route   GET /api/subscription/plans
// @access  Private
const getSubscriptionPlans = async (req, res) => {
    try {
        const plans = [
            {
                id: 'monthly',
                name: 'Monthly Pro',
                price: 299,
                duration: '1 Month',
                features: [
                    'Unlimited access to all assessment modules',
                    'Comprehensive study resources',
                    'Detailed performance analytics',
                    'Priority support'
                ]
            },
            {
                id: 'yearly',
                name: 'Yearly Pro',
                price: 1499,
                duration: '1 Year',
                features: [
                    'Everything in Monthly plan',
                    'Save over 65% annually',
                    'Early access to new features',
                    'Dedicated mentor support'
                ]
            }
        ];
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching plans' });
    }
};

module.exports = { createOrder, verifyPayment, getSubscriptionHistory, cancelSubscription, upgradeSubscription, getSubscriptionPlans };
