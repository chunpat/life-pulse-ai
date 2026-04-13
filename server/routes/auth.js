const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const appleSignin = require('apple-signin-auth');
const User = require('../models/User');

const buildAuthResponse = (user) => ({
  token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' }),
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    isOfficial: user.isOfficial,
    authProvider: user.authProvider,
    status: 'authenticated'
  }
});

const getAppleAudiences = () => {
  const configured = process.env.APPLE_CLIENT_IDS || process.env.APPLE_CLIENT_ID;
  if (!configured) {
    return ['ai.lifepulse.app'];
  }

  return configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildAppleNicknameCandidates = ({ givenName, familyName, email, appleSubject }) => {
  const displayName = [familyName, givenName].filter(Boolean).join('') || [givenName, familyName].filter(Boolean).join(' ');
  const emailPrefix = email ? email.split('@')[0] : '';
  const subjectSuffix = appleSubject.slice(-6);

  return [
    displayName,
    emailPrefix,
    `Apple用户${subjectSuffix}`,
    `Apple_${subjectSuffix}`
  ].map((item) => item?.trim()).filter(Boolean);
};

const generateUniqueUserName = async (candidates) => {
  for (const candidate of candidates) {
    const existing = await User.findOne({ where: { name: candidate } });
    if (!existing) {
      return candidate;
    }
  }

  const fallbackBase = candidates[0] || 'Apple用户';
  for (let index = 1; index <= 20; index += 1) {
    const nextName = `${fallbackBase}${index}`;
    const existing = await User.findOne({ where: { name: nextName } });
    if (!existing) {
      return nextName;
    }
  }

  return `${fallbackBase}_${crypto.randomBytes(3).toString('hex')}`;
};

// 注册
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referrerId, source, isOfficial } = req.body;
    
    // 检查昵称是否已存在
    const existingName = await User.findOne({ where: { name } });
    if (existingName) {
      return res.status(400).json({ message: '该昵称已被使用' });
    }

    // 如果填写了邮箱，检查邮箱是否已存在
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ message: '该邮箱已被注册' });
      }
    }

    const user = await User.create({ 
      name, 
      email: email || null, 
      password,
      referrerId: referrerId || null,
      source: source || null,
      isOfficial: Boolean(isOfficial)
    });
    
    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    res.status(500).json({ message: '注册失败', error: error.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    // 支持通过昵称或邮箱登录
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          { name: name },
          { email: name }
        ]
      } 
    });

    if (!user) {
      return res.status(400).json({ message: '用户不存在' });
    }

    if (user.authProvider === 'apple' && user.appleSubject) {
      return res.status(400).json({ message: '该账号已绑定 Apple 登录，请使用 Apple 登录继续' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: '密码错误' });
    }

    res.json(buildAuthResponse(user));
  } catch (error) {
    res.status(500).json({ message: '登录失败', error: error.message });
  }
});

router.post('/apple', async (req, res) => {
  try {
    const { identityToken, authorizationCode, email, givenName, familyName } = req.body;

    if (!identityToken) {
      return res.status(400).json({ message: '缺少 Apple 身份令牌' });
    }

    const verifiedToken = await appleSignin.verifyIdToken(identityToken, {
      audience: getAppleAudiences()
    });

    const appleSubject = verifiedToken.sub;
    const verifiedEmail = verifiedToken.email || email || null;

    if (!appleSubject) {
      return res.status(400).json({ message: 'Apple 身份校验失败' });
    }

    let user = await User.findOne({ where: { appleSubject } });

    if (!user && verifiedEmail) {
      user = await User.findOne({ where: { email: verifiedEmail } });
      if (user && user.appleSubject && user.appleSubject !== appleSubject) {
        return res.status(409).json({ message: '该邮箱已绑定其他 Apple 账号' });
      }
      if (user) {
        user.appleSubject = appleSubject;
        if (!user.authProvider) {
          user.authProvider = 'local';
        }
        await user.save();
      }
    }

    if (!user) {
      const nickname = await generateUniqueUserName(buildAppleNicknameCandidates({
        givenName,
        familyName,
        email: verifiedEmail,
        appleSubject
      }));

      user = await User.create({
        name: nickname,
        email: verifiedEmail,
        password: crypto.randomBytes(24).toString('hex'),
        authProvider: 'apple',
        appleSubject,
        source: 'apple',
        metadata: undefined
      });
    } else if (!user.appleSubject) {
      user.appleSubject = appleSubject;
      await user.save();
    }

    if (verifiedEmail && !user.email) {
      user.email = verifiedEmail;
      await user.save();
    }

    if (user.authProvider !== 'local') {
      user.authProvider = 'apple';
      await user.save();
    }

    res.json(buildAuthResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Apple 登录失败', error: error.message });
  }
});

module.exports = router;
