const Resource = require('../models/Resource');

// @desc    Get all study resources
// @route   GET /api/resources
// @access  Public
const getResources = async (req, res) => {
    try {
        const resources = await Resource.find({});
        res.json(resources);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a resource
// @route   POST /api/resources
// @access  Private/Admin
const createResource = async (req, res) => {
    const { title, type, url, category, isFree } = req.body;

    const resource = new Resource({
        title,
        type,
        url,
        category,
        uploadedBy: req.user._id,
        isFree: isFree !== undefined ? isFree : true,
    });

    const createdResource = await resource.save();
    res.status(201).json(createdResource);
};

module.exports = { getResources, createResource };
