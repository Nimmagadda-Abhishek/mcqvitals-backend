const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            required: true,
            default: 'student',
            enum: ['student', 'admin'],
        },
        profileImage: {
            type: String,
            default: '',
        },
        academicBio: {
            type: String,
            default: '',
        },
        stats: {
            totalTests: { type: Number, default: 0 },
            averageScore: { type: Number, default: 0 },
            totalTime: { type: Number, default: 0 },
        },
        passwordResetOtp: {
            type: String,
            default: null,
        },
        passwordResetOtpExpires: {
            type: Date,
            default: null,
        },
        isApproved: {
            type: Boolean,
            default: false,
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        subscription: {
            plan: {
                type: String,
                enum: ['none', 'monthly', 'yearly'],
                default: 'none'
            },
            status: {
                type: String,
                enum: ['inactive', 'active'],
                default: 'inactive'
            },
            expiryDate: {
                type: Date,
                default: null
            }
        },
        deviceId: {
            type: String,
            default: null,
        },
        deviceChangeRequested: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
