const requireApproved = (req, res, next) => {
    // Only gate student accounts
    if (req.user && req.user.role === 'student') {
        if (!req.user.isApproved) {
            return res.status(403).json({
                message: 'Your account is pending admin approval. Please try again later.',
            });
        }
    }
    return next();
};

module.exports = requireApproved;

