const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @desc    Get pending student approvals
// @route   GET /api/admin/approvals/pending
// @access  Private/Admin
const getPendingApprovals = async (req, res) => {
    const pending = await User.find({ role: 'student', isApproved: false }).select('-password');
    res.json(pending);
};

// @desc    Approve a student
// @route   POST /api/admin/approvals/:userId/approve
// @access  Private/Admin
const approveStudent = async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user || user.role !== 'student') {
        return res.status(404).json({ message: 'Student not found' });
    }

    user.isApproved = true;
    user.approvedAt = new Date();
    user.approvedBy = req.user._id;

    await user.save();

    // Email student
    try {
        await sendEmail({
            to: user.email,
            subject: 'Your scholar account has been approved',
            text: `Hi Scholar,\n\nYour account has been approved by the admin.\nPlease login to access the best resources.`,
            html: `<p>Hi Scholar,</p><p>Your account has been <b>approved by the admin</b>.</p><p>Please <b>login</b> to access the best resources.</p>`,
        });
    } catch (e) {
        console.error('Student approval email failed:', e.message || e);
    }

    return res.json({
        message: 'Student approved successfully',
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isApproved: user.isApproved,
            approvedAt: user.approvedAt,
        },
    });
};

module.exports = { getPendingApprovals, approveStudent };

