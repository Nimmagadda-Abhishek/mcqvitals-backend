const { ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/s3');

const BUCKET = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
const S3_PREFIX = 'test-platform/';

// @desc    Generate a pre-signed URL for a file in S3
// @route   GET /api/file-url/:filename
// @access  Public
const getFileUrl = async (req, res) => {
    try {
        const { filename } = req.params;

        // Prepend the project prefix if not already present
        const key = filename.startsWith(S3_PREFIX) ? filename : `${S3_PREFIX}${filename}`;

        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
        });

        // Pre-signed URL expires in 1 hour (3600 seconds)
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.json({ url: signedUrl });
    } catch (error) {
        console.error('Get File URL Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    List all files in the S3 bucket (only this project's folder)
// @route   GET /api/files
// @access  Public
const listFiles = async (req, res) => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: S3_PREFIX,
        });

        const response = await s3Client.send(command);

        // If the folder is empty, Contents will be undefined
        const files = (response.Contents || []).map((item) => ({
            filename: item.Key.replace(S3_PREFIX, ''),
            fileType: item.Key.split('.').pop() || 'unknown',
            uploadedAt: item.LastModified,
            size: item.Size,
        }));

        res.json(files);
    } catch (error) {
        console.error('List Files Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getFileUrl, listFiles };
