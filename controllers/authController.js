const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');

const generateOtp = () => {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP
};


// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    const user = await User.create({
        name,
        email,
        password,
        role: 'student',
        isApproved: false,
        subscription: {
            plan: 'monthly',
            status: 'active',
            expiryDate: expiryDate,
        },
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid user data');
    }

    // Notify admin for approval
    try {
        const adminEmail = process.env.ADMIN_EMAIL || (await User.findOne({ role: 'admin' })).email;
        if (adminEmail) {
            await sendEmail({
                to: adminEmail,
                subject: 'New scholar registered - waiting for approval',
                text: `Hi Admin,\n\nA new scholar has registered to the platform and is waiting for your approval.\n\nScholar: ${user.name} (${user.email})\n\nPlease review and approve them to grant dashboard access.`,
                html: `<p>Hi Admin,</p><p>A new scholar has <b>registered</b> on the platform and is <b>waiting for your approval</b>.</p><p><b>Scholar:</b> ${user.name} (${user.email})</p><p>Please approve to grant access to the dashboard and best resources.</p>`,
            });
        }
    } catch (e) {
        console.error('Admin approval email failed:', e.message || e);
    }

    res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
        isApproved: user.isApproved,
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { email, password, deviceId } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        // Device Binding Logic
        if (user.role !== 'admin') {
            if (!deviceId) {
                res.status(400);
                throw new Error('Device ID is required for login');
            }

            if (user.deviceId === null) {
                // First time login, bind device
                user.deviceId = deviceId;
                await user.save();
            } else if (user.deviceId !== deviceId) {
                // Device mismatch
                return res.status(401).json({
                    message: 'Device mismatch. You are already locked to another device.',
                    deviceMismatch: true,
                });
            }
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
            isApproved: user.isApproved,
            subscription: user.subscription,
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
};

// @desc    Request a device change
// @route   POST /api/auth/request-device-change
// @access  Public
const requestDeviceChange = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Email is required');
    }

    const user = await User.findOne({ email });

    if (!user) {
        // To prevent email enumeration
        return res.json({ message: 'If the account exists, a request has been submitted.' });
    }

    user.deviceChangeRequested = true;
    await user.save();

    try {
        const adminEmail = process.env.ADMIN_EMAIL || (await User.findOne({ role: 'admin' })).email;
        if (adminEmail) {
            await sendEmail({
                to: adminEmail,
                subject: 'Device Change Request - waiting for approval',
                text: `Hi Admin,\n\nA scholar has requested a device change and is waiting for your approval.\n\nScholar: ${user.name} (${user.email})\n\nPlease review and approve the request from the admin dashboard.`,
                html: `<p>Hi Admin,</p><p>A scholar has requested a <b>device change</b> and is <b>waiting for your approval</b>.</p><p><b>Scholar:</b> ${user.name} (${user.email})</p><p>Please review and approve the request from the admin dashboard.</p>`,
            });
        }
    } catch (e) {
        console.error('Admin device change email failed:', e.message || e);
    }

    res.json({ message: 'Device change request submitted successfully. Please wait for admin approval.' });
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            stats: user.stats,
            profileImage: user.profileImage,
            subscription: user.subscription,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        // Only allow academicBio and profileImage updates
        user.academicBio = req.body.academicBio || user.academicBio;
        
        // If file was uploaded via multer-s3 middleware
        if (req.file && req.file.location) {
            user.profileImage = req.file.location;
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            academicBio: updatedUser.academicBio,
            profileImage: updatedUser.profileImage,
            stats: updatedUser.stats,
            subscription: updatedUser.subscription,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Request password reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const requestPasswordResetOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Email is required');
    }

    const user = await User.findOne({ email });

    // For security, do not reveal whether user exists
    if (!user) {
        return res.json({ message: 'If the email exists, an OTP has been sent.' });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.passwordResetOtp = otp;
    user.passwordResetOtpExpires = otpExpires;
    await user.save();

    await sendEmail({
        to: user.email,
        subject: 'Password reset OTP',
        text: `Hi Scholar, Your OTP for reset password is: ${otp}. It expires in 10 minutes.`,
        html: `<p>HI Scholar, Your OTP for reset password is: <b>${otp}</b>.</p><p>It expires in 10 minutes.</p>`,
    });

    return res.json({ message: 'OTP sent to your email.' });
};

// @desc    Confirm password reset using OTP
// @route   POST /api/auth/reset-password
// @access  Public
const confirmPasswordReset = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        res.status(400);
        throw new Error('Email, otp, and newPassword are required');
    }

    const user = await User.findOne({ email });

    if (!user || !user.passwordResetOtp || !user.passwordResetOtpExpires) {
        res.status(400);
        throw new Error('Invalid OTP request');
    }

    const isExpired = new Date(user.passwordResetOtpExpires).getTime() < Date.now();
    if (isExpired) {
        res.status(400);
        throw new Error('OTP has expired');
    }

    if (String(user.passwordResetOtp) !== String(otp)) {
        res.status(400);
        throw new Error('Invalid OTP');
    }

    user.password = newPassword;
    user.passwordResetOtp = null;
    user.passwordResetOtpExpires = null;

    await user.save();

    return res.json({ message: 'Password has been reset successfully.' });
};

module.exports = {
    registerUser,
    authUser,
    getUserProfile,
    updateUserProfile,
    requestPasswordResetOtp,
    confirmPasswordReset,
    requestDeviceChange,
};
