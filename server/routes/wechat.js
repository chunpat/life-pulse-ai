const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// 缓存 ticket 和 token，避免频繁调用微信接口
let cachedTicket = {
  value: null,
  expires: 0
};
let cachedToken = {
  value: null,
  expires: 0
};

async function getAccessToken() {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('未配置微信 WECHAT_APP_ID 或 WECHAT_APP_SECRET');
  }

  if (cachedToken.value && cachedToken.expires > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`);
  const data = await response.json();

  if (data.errcode) {
    throw new Error(`微信 Token 获取失败: ${data.errmsg}`);
  }

  cachedToken.value = data.access_token;
  cachedToken.expires = Date.now() + (data.expires_in - 200) * 1000;
  return data.access_token;
}

async function getJsApiTicket(token) {
  if (cachedTicket.value && cachedTicket.expires > Date.now()) {
    return cachedTicket.value;
  }

  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${token}&type=jsapi`);
  const data = await response.json();

  if (data.errcode) {
    throw new Error(`微信 Ticket 获取失败: ${data.errmsg}`);
  }

  cachedTicket.value = data.ticket;
  cachedTicket.expires = Date.now() + (data.expires_in - 200) * 1000;
  return data.ticket;
}

function createSignature(ticket, nonceStr, timestamp, url) {
  const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(str).digest('hex');
}

router.get('/config', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ message: '请提供 URL' });

    // 如果没有配置，返回一个提示状态，前端可以优雅退化
    if (!process.env.WECHAT_APP_ID) {
      return res.status(200).json({ enabled: false, message: '未配置微信参数' });
    }

    const token = await getAccessToken();
    const ticket = await getJsApiTicket(token);
    
    const nonceStr = Math.random().toString(36).substr(2, 15);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createSignature(ticket, nonceStr, timestamp, url);

    res.json({
      enabled: true,
      appId: process.env.WECHAT_APP_ID,
      timestamp,
      nonceStr,
      signature
    });
  } catch (error) {
    console.error('WeChat Config Error:', error);
    res.status(500).json({ message: '获取微信配置失败', error: error.message });
  }
});

module.exports = router;
