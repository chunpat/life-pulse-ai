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

// 逆地理编码代理，解决前端跨域或被拦截问题
router.get('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: '缺少经纬度参数' });

    const tk = process.env.TIANDITU_TOKEN;
    
    // 只有配置了 TIANDITU_TOKEN 且坐标在国内时，才优先使用天地图
    if (tk) {
      try {
        const tiandituUrl = `http://api.tianditu.gov.cn/geocoder?postStr={'lon':${lng},'lat':${lat},'ver':1}&type=geocode&tk=${tk}`;
        const response = await fetch(tiandituUrl);
        const data = await response.json();
        
        if (data.status === '0' && data.result) {
          const addr = data.result.addressComponent;
          const address = data.result.formatted_address || `${addr.city}${addr.county}${addr.address}`;
          return res.json({ address, source: 'tianditu' });
        }
      } catch (e) {
        console.warn('天地图响应异常，降级到 OSM:', e.message);
      }
    }

    // 默认或备用方案：OpenStreetMap (OSM)
    // 即使在国内，后端服务器通常也能访问 Nominatim
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=zh-CN`;
      const response = await fetch(osmUrl, {
        headers: { 'User-Agent': 'LifePulseAI-Server/1.0' }
      });
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        const parts = [
          addr.road || addr.building || addr.amenity || addr.city_district || addr.suburb,
          addr.district || addr.city || addr.province
        ].filter(Boolean);
        const address = parts.length > 0 ? parts.join(', ') : (data.display_name.split(',')[0]);
        return res.json({ address, source: 'osm' });
      }
    } catch (e) {
      console.error('所有地理编码服务均不可用:', e);
    }

    // 兜底返回原始坐标字符串
    res.json({ address: `位置 (${parseFloat(lat).toFixed(2)}, ${parseFloat(lng).toFixed(2)})` });
  } catch (error) {
    console.error('Reverse Geocode Proxy Error:', error);
    res.status(500).json({ message: '地址解析服务异常' });
  }
});

module.exports = router;
