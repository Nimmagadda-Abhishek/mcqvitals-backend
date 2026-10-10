const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const razorpayPath = require.resolve('razorpay');
const userPath = require.resolve('../models/User');
const orderPath = require.resolve('../models/SubscriptionOrder');
const originalModules = new Map(
  [razorpayPath, userPath, orderPath].map((path) => [path, require.cache[path]])
);
const originalKeyId = process.env.RAZORPAY_KEY_ID;
const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
const createdOrders = [];
let razorpayOrderOptions;

class MockRazorpay {
  constructor() {
    this.orders = {
      create: async (options) => {
        razorpayOrderOptions = options;
        return { id: 'order_test_123', ...options };
      },
    };
    this.subscriptions = {
      create: async () => {
        throw new Error('Recurring subscription creation must not be used');
      },
    };
  }
}

class MockSubscriptionOrder {
  constructor(data) {
    Object.assign(this, data, { status: 'created' });
  }

  async save() {
    if (!createdOrders.includes(this)) {
      createdOrders.push(this);
    }
  }

  static async findOne(query) {
    return createdOrders.find(
      (order) => order.orderId === query.orderId && order.userId === query.userId
    ) || null;
  }
}

const user = { _id: 'user-1', subscription: null, save: async () => {} };
const MockUser = { findById: async () => user };

process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
require.cache[razorpayPath] = { exports: MockRazorpay };
require.cache[userPath] = { exports: MockUser };
require.cache[orderPath] = { exports: MockSubscriptionOrder };

const { createOrder, verifyPayment } = require('../controllers/subscriptionController');

function createResponse() {
  return {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('subscription checkout creates and verifies a one-time Razorpay order', async () => {
  const createRes = createResponse();
  await createOrder({ user: { _id: user._id }, body: { plan: 'yearly' } }, createRes);

  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.payload.orderId, 'order_test_123');
  assert.equal(razorpayOrderOptions.amount, 149900);
  assert.equal(razorpayOrderOptions.currency, 'INR');
  assert.match(razorpayOrderOptions.receipt, /^user-1-\d+$/);
  assert.equal(createdOrders[0].plan, 'yearly');

  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update('order_test_123|pay_test_123')
    .digest('hex');
  const verifyRes = createResponse();
  await verifyPayment(
    {
      user: { _id: user._id },
      body: {
        razorpay_order_id: 'order_test_123',
        razorpay_payment_id: 'pay_test_123',
        razorpay_signature: signature,
        plan: 'monthly',
      },
    },
    verifyRes
  );

  assert.equal(verifyRes.payload.message, 'Payment verified successfully');
  assert.equal(createdOrders[0].status, 'paid');
  assert.equal(user.subscription.plan, 'yearly');
  assert.ok(user.subscription.expiryDate > new Date(Date.now() + 340 * 24 * 60 * 60 * 1000));
});

process.on('exit', () => {
  for (const [path, originalModule] of originalModules) {
    if (originalModule) {
      require.cache[path] = originalModule;
    } else {
      delete require.cache[path];
    }
  }

  if (originalKeyId === undefined) {
    delete process.env.RAZORPAY_KEY_ID;
  } else {
    process.env.RAZORPAY_KEY_ID = originalKeyId;
  }

  if (originalKeySecret === undefined) {
    delete process.env.RAZORPAY_KEY_SECRET;
  } else {
    process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
  }
});
