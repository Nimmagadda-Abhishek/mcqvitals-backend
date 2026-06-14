const express = require('express');
const {
    registerUser,
    authUser,
    getUserProfile,
    updateUserProfile,
    requestPasswordResetOtp,
    confirmPasswordReset,
    requestDeviceChange,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/forgot-password', requestPasswordResetOtp);
router.post('/reset-password', confirmPasswordReset);
router.post('/request-device-change', requestDeviceChange);
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, upload.single('profileImage'), updateUserProfile);

module.exports = router;
