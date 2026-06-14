const express = require('express');
const { getResources, createResource } = require('../controllers/resourceController');
const { protect, admin } = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');



const router = express.Router();

router.route('/')
    .get(protect, requireApproved, getResources)
    .post(protect, admin, createResource);


module.exports = router;

