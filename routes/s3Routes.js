const express = require('express');
const { getFileUrl, listFiles } = require('../controllers/s3Controller');

const router = express.Router();

// GET /api/file-url/:filename  — pre-signed S3 URL (1 hour expiry)
router.get('/file-url/:filename', getFileUrl);

// GET /api/files  — list all files in the S3 bucket
router.get('/files', listFiles);

module.exports = router;
