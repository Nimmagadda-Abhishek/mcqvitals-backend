const express = require('express');
const upload = require('../middleware/uploadMiddleware');
const { protect, admin } = require('../middleware/authMiddleware');
const { 
    getDashboardStats, 
    getAllUsers, 
    getAllResults, 
    getAllSubscriptions,
    createTest, 
    addQuestionToTest, 
    deleteTest, 
    createResource,
    deleteResource,
    updateQuestion,
    deleteQuestion,
    getTestById,
    updateTest,
    getDeviceChangeRequests,
    approveDeviceChange
} = require('../controllers/adminController');
const { getPendingApprovals, approveStudent } = require('../controllers/adminApprovalController');


const router = express.Router();

// Logging to verify route loading
console.log('Admin routes initializing...');

router.get('/dashboard', protect, admin, getDashboardStats);
router.get('/users', protect, admin, getAllUsers);
router.get('/results', protect, admin, getAllResults);
router.get('/subscriptions', protect, admin, getAllSubscriptions);

// Approvals
router.get('/approvals/pending', protect, admin, getPendingApprovals);
router.post('/approvals/:userId/approve', protect, admin, approveStudent);

// Device Change Approvals
router.get('/device-change-requests', protect, admin, getDeviceChangeRequests);
router.post('/device-change-requests/:id/approve', protect, admin, approveDeviceChange);


// Test Management
router.post('/tests', protect, admin, createTest);
router.get('/tests/:id', protect, admin, getTestById);
router.put('/tests/:id', protect, admin, updateTest);
router.post('/tests/:testId/questions', protect, admin, addQuestionToTest);
router.put('/questions/:id', protect, admin, updateQuestion);
router.delete('/questions/:id', protect, admin, deleteQuestion);
router.delete('/tests/:id', protect, admin, deleteTest);

// Resources
router.post('/resources', protect, admin, createResource);
router.delete('/resources/:id', protect, admin, deleteResource);

// Uploads (S3)
router.post('/upload', protect, admin, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    res.send({
        message: 'File uploaded successfully',
        url: req.file.location,
    });
});

module.exports = router;
