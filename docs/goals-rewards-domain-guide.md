# LifePulse AI 目标、积分与徽章规则说明

这份文档描述的是当前代码里的已实现规则，主要对应：

- `server/services/goalService.js`
- `server/services/rewardService.js`
- `server/routes/goals.js`
- `components/GoalPlanner.tsx`
- `components/Logger.tsx`

它不是未来设计稿。像 `GOAL_REWARDS_BADGES_DESIGN.md` 这种文件更偏方案设计，这里记录的是当前实际行为。

## 1. 目标类型与来源

当前目标分两类：

- 个人目标：用户自行创建，类型为 `7_DAY` 或 `21_DAY`
- 官方目标：从官方模板发起，带 `officialPlanId`

当前后端创建入口都在 `createGoalForUser`。

## 2. 当前目标状态

当前主要状态：

- `active`
- `paused`
- `completed`
- `failed`

说明：

- `paused` 可以恢复
- `failed` 不会自动恢复，只能重启
- `completed` 代表目标已达成，会触发完成奖励和徽章逻辑

## 3. 当前核心规则

### 多目标并行

- 用户可以同时有多条目标进行中
- 一条日志可能同时推进多条符合语义的 active 目标

### 日志命中规则

- 只有当天未打卡且与日志语义相关的 active 目标会创建 check-in
- 匹配逻辑在 `server/services/goalService.js`
- 不要把目标命中逻辑复制到前端

### 暂停与恢复

- 只有 active 目标可以暂停
- 只有 paused 目标可以恢复
- 恢复后保留 `completedDays`
- 恢复后 `currentStreak` 归零
- 恢复后 `lastCheckInDate` 清空

### 失败与重启

- 目标错过日推进窗口后可能进入 `failed`
- failed 目标不会继续在 Logger 首页主卡展示
- 重启会清空本轮 `currentStreak`、`lastCheckInDate`、完成状态相关字段
- 重启会删除旧 `GoalCheckin`
- 当前重启额度按每 7 天 1 次计算：7_DAY = 1 次，21_DAY = 3 次

### 删除

- 未开始目标可删除
- 已开始目标按用户 + 自然月统计，当月最多删除 1 个已开始目标

## 4. 主奖励目标规则

系统把目标区分成两种奖励角色：

- `primary`
- `tracking`

含义：

- `tracking` 目标可以被日志推进，但不一定拿到每日推进积分或完成积分
- `primary` 是当前唯一参与主奖励结算的目标

当前规则：

- 同时进行多个目标时，只会有一个 `primary`
- 创建个人目标时，如果当前已有 active 的 `primary`，新目标默认是 `tracking`
- 创建官方目标时，会先把当前 active 目标全部降为 `tracking`，新官方目标变成 `primary`
- 有官方计划进行中时，不能把个人目标设为主奖励目标

## 5. 当前积分规则

当前积分实现落在 `server/services/rewardService.js`。

### 每日有效日志积分

- 常量：`DAILY_VALID_LOG_POINTS = 2`
- 当天第 1 条有效日志给 2 分
- 同一天后续日志不重复发
- 幂等键：`daily-valid-log:{userId}:{dateKey}`

### 主奖励目标日推进积分

- 常量：`DAILY_PRIMARY_GOAL_POINTS = 1`
- 只有当天的 primary 目标推进成功时才可能获得
- 同一天最多 1 分
- 幂等键：`daily-primary-progress:{goalId}:{dateKey}`

### 目标完成积分

- `7_DAY` 完成：20 分
- `21_DAY` 完成：60 分
- 官方目标完成分值取官方模板里的 `completionPoints`
- 只有 `rewardRole === 'primary'` 的目标完成时才发完成积分
- 幂等键：`goal-complete-points:{goalId}`

### 等级

- 常量：`LEVEL_STEP_POINTS = 50`
- 每 50 累计积分升 1 级
- 等级根据 `lifetimePoints` 计算，不是 `availablePoints`

## 6. 当前徽章规则

### 个人目标徽章

- `7_DAY`：`goal_7_day_completed`
- `21_DAY`：`goal_21_day_completed`

### 官方目标徽章

- 官方目标完成后的徽章编码、标题、短标题、颜色、主题都来自官方模板

### 发放逻辑

- 徽章通过 `issueBadge` 发放
- issueKey 当前使用 `goal-completion-badge:{goalId}` 做幂等控制
- 同一个目标不会重复发同一枚完成徽章

### 前端展示

- 奖励中心会读取徽章 metadata 做展示
- `GoalPlanner.tsx` 和 `Logger.tsx` 也会消费目标上的徽章 / 主题信息做 UI 呈现

## 7. 当前反刷分与幂等约束

- 每日有效日志积分按天幂等
- 每日主目标推进积分按天幂等
- 完成积分按目标幂等
- 徽章发放按 `issueKey` 幂等
- 当前结算日期使用服务端 settlement 时间生成 `dateKey`

## 8. 改目标或奖励时必须一起检查的文件

- `server/services/goalService.js`
- `server/services/rewardService.js`
- `server/routes/goals.js`
- `server/routes/rewards.js`
- `components/GoalPlanner.tsx`
- `components/Logger.tsx`
- `services/goalService.ts`
- `services/rewardService.ts`
- `types.ts`

## 9. 改动后的最低手测

- 创建一个个人目标
- 创建一个官方目标
- 写一条能命中目标的日志
- 验证 active 目标推进和列表刷新
- 验证 daily valid log 积分是否只发一次
- 验证 primary 目标推进积分是否只发一次
- 完成一个目标并确认完成积分与徽章发放
- 如改了暂停 / 恢复 / 重启 / 删除逻辑，至少走通其中一条完整路径
