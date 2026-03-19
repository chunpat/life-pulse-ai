const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Polyfill fetch for Node.js < 18 (required by OpenAI SDK)
if (!globalThis.fetch) {
  const fetch = require('node-fetch');
  globalThis.fetch = fetch;
  globalThis.Headers = fetch.Headers;
  globalThis.Request = fetch.Request;
  globalThis.Response = fetch.Response;
  
  // 补充 Node 16 缺少的 FormData 和 Blob
  if (!globalThis.FormData) {
    const FormData = require('form-data');
    globalThis.FormData = FormData;
  }
}

require('dotenv').config();
const sequelize = require('./config/database');
const {
  cleanupDuplicateUserUniqueIndexes,
  getDatabaseSyncMode,
  getDatabaseSyncOptions
} = require('./utils/databaseSync');

const app = express();

// Middleware
app.use(cors()); // 最基础的配置，允许所有
app.use(express.json());
app.use(morgan('dev'));

// 日志记录中间件，用于调试 403
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const logRoutes = require('./routes/logs');
const aiRoutes = require('./routes/ai');
const financeRoutes = require('./routes/finance');
const goalRoutes = require('./routes/goals');
const officialPlanRoutes = require('./routes/officialPlans');
const rewardRoutes = require('./routes/rewards');
const uploadRoutes = require('./routes/upload');
const wechatRoutes = require('./routes/wechat');
app.use('/api/auth', authRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/official-plans', officialPlanRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wechat', wechatRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('LifePulse AI API is running...');
});

// Database Sync & Server Start
const PORT = process.env.PORT || 5002;
const User = require('./models/User');
const Log = require('./models/Log');
const FinanceRecord = require('./models/FinanceRecord');
const Goal = require('./models/Goal');
const GoalCheckin = require('./models/GoalCheckin');
const OfficialPlanTemplate = require('./models/OfficialPlanTemplate');
const RewardProfile = require('./models/RewardProfile');
const RewardLedger = require('./models/RewardLedger');
const UserBadge = require('./models/UserBadge');
const { ensureOfficialPlanTemplates } = require('./services/officialPlanService');
const syncMode = getDatabaseSyncMode();

cleanupDuplicateUserUniqueIndexes(sequelize)
  .then((removedIndexes) => {
    if (removedIndexes.length) {
      console.log(`Removed duplicate user indexes: ${removedIndexes.join(', ')}`);
    }

    console.log(`Database sync mode: ${syncMode}`);
    return sequelize.sync(getDatabaseSyncOptions());
  })
  .then(async () => {
    await ensureOfficialPlanTemplates();
    console.log('Database connected and synced');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on http://0.0.0.0:${PORT}`);
      console.log(`Try accessing http://127.0.0.1:${PORT}/ to verify`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
