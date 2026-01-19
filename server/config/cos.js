const COS = require('cos-nodejs-sdk-v5');
require('dotenv').config();

const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY,
});

const uploadToCOS = (file) => {
    return new Promise((resolve, reject) => {
        // 过滤文件名中的空格，避免 URL 链接失效
        const sanitizedName = file.originalname.replace(/\s+/g, '_');
        const fileName = `${Date.now()}-${sanitizedName}`;
        cos.putObject({
            Bucket: process.env.COS_BUCKET,
            Region: process.env.COS_REGION,
            Key: `uploads/${fileName}`,
            StorageClass: 'STANDARD',
            Body: file.buffer,
        }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                // If CDN is configured, return CDN URL, otherwise return COS URL
                const baseUrl = process.env.CDN_URL || `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`;
                resolve(`${baseUrl}/uploads/${fileName}`);
            }
        });
    });
};

module.exports = { cos, uploadToCOS };
