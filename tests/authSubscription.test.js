const test = require('node:test');
const assert = require('node:assert/strict');

const sendEmailPath = require.resolve('../utils/sendEmail');
const tokenPath = require.resolve('../utils/generateToken');
const originalSendEmail = require.cache[sendEmailPath]?.exports;
const originalToken = require.cache[tokenPath]?.exports;

require.cache[sendEmailPath] = { exports: async () => ({}) };
require.cache[tokenPath] = { exports: () => 'mock-token' };

const User = require('../models/User');
const { registerUser } = require('../controllers/authController');

const originalFindOne = User.findOne;
const originalCreate = User.create;

test('registerUser does not assign a free one-month subscription', async () => {
  let createdPayload = null;

  User.findOne = async (query) => {
    if (query && query.email) {
      return null;
    }
    return { email: 'admin@mcqvitals.com' };
  };

  User.create = async (data) => {
    createdPayload = data;
    return {
      _id: 'user-1',
      name: data.name,
      email: data.email,
      role: data.role,
      isApproved: data.isApproved,
      subscription: data.subscription,
    };
  };

  const res = {
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await registerUser(
    { body: { name: 'Test User', email: 'user@example.com', password: 'secret123' } },
    res
  );

  assert.deepEqual(createdPayload.subscription, {
    plan: 'none',
    status: 'inactive',
    expiryDate: null,
  });
  assert.equal(res.code, 201);
  assert.equal(res.payload.token, 'mock-token');
});

process.on('exit', () => {
  User.findOne = originalFindOne;
  User.create = originalCreate;

  if (originalSendEmail) {
    require.cache[sendEmailPath] = { exports: originalSendEmail };
  }

  if (originalToken) {
    require.cache[tokenPath] = { exports: originalToken };
  }
});
