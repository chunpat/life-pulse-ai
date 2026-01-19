const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToCOS } = require('../config/cos');
const authenticateToken = require('../middleware/auth');

// Using memory storage as we upload directly to COS
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '请选择图片文件' });
        }

        const url = await uploadToCOS(req.file);
        res.json({ url });
    } catch (err) {
        console.error('Upload Error:', err);
        res.status(500).json({ message: '图片上传失败', error: err.message });
    }
});

module.exports = router;
