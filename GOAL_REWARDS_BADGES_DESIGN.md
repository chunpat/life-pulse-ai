# 计划积分、官方徽章与认证体系设计

## 1. 目标

这套体系要解决三件事：

1. 让用户完成计划后有明确反馈，不只是进度条结束。
2. 让“官方计划”具备更强的品牌感、稀缺性和可认证价值。
3. 在当前“多计划并行、一条日志可同步推进多个 active 计划”的机制下，避免被刷积分。

基于现有实现，计划系统已经具备这些基础：

- 计划支持并行进行。
- 一条日志会给当天未打卡的所有 active 计划同步打卡。
- 暂停/恢复会影响 streak，但保留 completedDays。
- 日志接口允许客户端传入 timestamp。

其中第四点是后续积分和官方认证的核心风险点。如果继续直接信任客户端 timestamp，用户可以一次性补录历史时间，快速刷满 7 天/21 天计划。因此积分结算和认证判断必须改为以服务端结算时间为准。

## 2. 核心原则

### 2.1 完成和认证分开

计划完成不等于官方认证完成。

- 完成：用户已经满足计划的天数要求。
- 认证：平台确认用户满足官方计划要求，发放官方认证徽章。

这样可以支持：

- 普通个人计划：完成即结束，无需认证。
- 官方基础计划：完成后自动认证。
- 官方严格计划：完成后进入待审核，审核通过才拿到官方徽章。

### 2.2 积分按“行为价值”发，不按“并行计划数量”倍增

由于当前一条日志会推进多个计划，如果按每个计划每日打卡都发积分，会天然产生刷分空间。

因此积分要拆成两类：

- 日常行为积分：按“当天是否完成有效记录”结算。
- 计划完成积分：只给一个可奖励计划结算，不因并行计划数倍增。

### 2.3 不建议对失败计划做惩罚性扣分

这个产品当前的气质更接近“鼓励持续记录”，不是强竞争系统。

建议：

- 普通失败不扣分。
- 只在作弊、撤销认证、管理员回滚时做积分冲正。

## 3. 产品定义

### 3.1 计划分层

计划分成三类：

1. 个人计划
2. 官方计划
3. 官方认证计划

区别如下：

| 类型 | 创建方式 | 是否有积分 | 是否有徽章 | 是否需要认证 |
| --- | --- | --- | --- | --- |
| 个人计划 | 用户自行创建 | 有，偏轻量 | 有，个人徽章 | 否 |
| 官方计划 | 从平台模板发起 | 有，权重更高 | 有，官方计划徽章 | 可选 |
| 官方认证计划 | 从平台模板发起 | 有，最高 | 有，官方认证徽章 | 是 |

### 3.2 计划状态新增语义

当前已有的计划状态：

- active
- paused
- completed
- failed

建议新增认证状态字段，而不是继续复用 status：

- not_required
- pending
- approved
- rejected

这样一个计划可以同时呈现：

- status = completed
- verificationStatus = pending

也就是“计划完成了，但官方认证还没通过”。

## 4. 积分体系

建议把积分命名为“成长积分”。

### 4.1 发放规则

#### A. 每日有效记录积分

- 当天第 1 条有效日志：+2
- 同一天后续日志：0
- 每日上限：2

有效日志建议满足至少一条：

- rawText 或 activity 长度达到最小阈值
- durationMinutes >= 10
- 带图片
- 带位置

目的：避免用极短文本反复刷分。

#### B. 可奖励计划日推进积分

- 当天 primaryRewardGoal 完成一次有效推进：+1
- 每日上限：1

这里的关键不是“所有 active 计划都发”，而是只对一个“可奖励主计划”发。

#### C. 完成积分

- 个人 7 天计划完成：+20
- 个人 21 天计划完成：+60
- 官方计划完成：+30
- 官方认证计划审核通过：+80

说明：

- 官方认证计划的高额奖励不在“完成”时立即全发，而是在认证通过后发。
- 如果官方认证计划完成了但审核没过，可以保留“完成记录”和少量参与积分，不发官方认证积分。

#### D. 完美连续加成

满足以下条件可给额外加成：

- 全周期无 pause
- 无补录
- 无审核驳回

建议奖励：

- 7 天完美完成：+10
- 21 天完美完成：+30
- 官方认证计划完美通过：+40

### 4.2 防刷分规则

必须同时落地以下规则：

1. 同一天只结算一次“每日有效记录积分”。
2. 同一天只结算一次“主计划日推进积分”。
3. 并行计划可以同时推进，但只能有一个 primaryRewardGoal 参与积分结算。
4. 官方计划进行中时，建议占用唯一奖励位，不允许同时存在另一个可奖励官方计划。
5. 删除计划不会回滚已经合法发放的积分，但同一事件不能二次发放。
6. 所有积分台账都必须带 idempotencyKey，避免重复请求重复加分。
7. 积分结算日期必须用服务端 receivedAt 对应的 dateKey，而不是客户端 timestamp。
8. 补录历史日志可以保留在时间线，但不参与成长积分和官方认证日数。

第 7 和第 8 条是这次设计里最重要的反作弊约束。

### 4.3 为什么要有 primaryRewardGoal

当前实现中，一条日志会同时给多个 active 计划打卡。这对产品体验很好，但对积分系统很危险。

因此建议保留“多计划同时推进”的体验，但增加一个额外概念：

- progressGoals：可以被日志推进的计划，保留当前逻辑。
- primaryRewardGoal：当前唯一参与积分和完成奖励结算的计划。

这样用户仍然可以同时做多个计划，但不会出现“一条日志拿 3 份完成积分”的问题。

## 5. 徽章体系

### 5.1 徽章分层

建议把徽章拆成四个家族：

1. 完成徽章
2. 官方徽章
3. 认证徽章
4. 声望徽章

#### 完成徽章

用于普通个人计划完成。

示例：

- 7 天冲刺完成
- 21 天养成完成
- 首次完成计划
- 连续完成 3 个计划

#### 官方徽章

用于参加平台官方模板计划。

示例：

- 官方计划 · 21 天早睡营
- 官方计划 · 晨跑打卡周

#### 认证徽章

用于需要平台审核的高价值官方计划。

示例：

- 官方认证 · 21 天早睡营
- 官方认证 · 晨跑挑战
- 导师签署 · 深度阅读计划

#### 声望徽章

用于体现累计成绩。

示例：

- 认证完成 1 次
- 认证完成 3 次
- 官方计划连续通过 5 次

### 5.2 徽章视觉语言

建议不要把所有徽章做成同一种样式，用户很难一眼分辨价值。

建议视觉分层：

- 个人完成徽章：圆形，偏温和，使用当前产品里的靛蓝/暖橙系。
- 官方计划徽章：六边形或盾形，有更强的品牌识别，加入深色底和金属边。
- 官方认证徽章：在官方徽章基础上增加“认证标识层”，例如金边、勾盾、认证绶带。
- 稀有季节徽章：保留主题色，但增加期次信息，例如 S1、春季限定、年度版。

一个推荐的徽章结构：

- 外圈：家族与等级
- 中心图形：计划主题
- 底部绶带：官方/认证文案
- 角标：期次、赛季、导师签章

### 5.3 徽章展示状态

用户侧建议支持这些展示状态：

- 已获得
- 待认证
- 已驳回
- 已失效

官方认证计划结束后，如果用户尚未提交材料，也要能显示“待提交认证材料”，否则用户会误以为系统没有发徽章。

## 6. 官方认证计划设计

### 6.1 适合要求认证的计划类型

不是所有计划都值得做审核。

建议只有这些类型开启认证：

- 官方训练营
- 需要外部证据的计划
- 有实物奖励或课程权益的计划
- 对外可展示的品牌成就计划

### 6.2 认证模式

建议支持四种认证模式：

1. none：无需认证
2. auto：系统自动认证
3. manual：人工审核
4. coach_sign：导师/教练签署

适用场景：

- auto：只要系统字段满足即可，例如每天日志必须包含时长和图片。
- manual：要上传证据，由运营审核。
- coach_sign：陪跑计划、课程营、线下活动。

### 6.3 认证材料

建议把认证材料做成独立结构，不要都塞进 Goal.metadata。

材料类型可以包括：

- 文本总结
- 图片
- 视频
- 外部链接
- 截图

官方模板里可以定义 evidenceSchema，例如：

- 至少上传 3 天截图
- 至少提交 1 份结营总结
- 至少 5 天带定位

### 6.4 审核结果处理

审核通过：

- 发放认证积分
- 发放官方认证徽章
- 更新 verificationStatus = approved

审核驳回：

- 保留 completed
- 不发官方认证徽章
- 不发认证积分
- 可选一次补充材料机会

## 7. 数据模型建议

### 7.1 在现有 Goal 上增加的字段

当前 Goal 模型位于 [server/models/Goal.js](server/models/Goal.js)。

建议新增：

- planScope: 'personal' | 'official'
- rewardRole: 'tracking' | 'primary' | 'official_primary'
- rewardEligible: boolean
- officialPlanId: UUID | null
- verificationMode: 'none' | 'auto' | 'manual' | 'coach_sign'
- verificationStatus: 'not_required' | 'pending' | 'approved' | 'rejected'
- verificationSubmittedAt: bigint | null
- verifiedAt: bigint | null
- verifiedBy: UUID | null
- pointsGranted: integer
- rewardSettledAt: bigint | null
- serverLastCheckInDate: DATEONLY | null

其中 serverLastCheckInDate 很关键。它要基于服务端结算日，而不是客户端 timestamp。

### 7.2 用户积分账户

建议新增 UserRewardProfile 表：

- userId
- availablePoints
- lifetimePoints
- spentPoints
- level
- verifiedBadgeCount
- officialCompletionCount

### 7.3 积分台账

建议新增 RewardLedger 表：

- id
- userId
- eventType
- amount
- balanceAfter
- goalId
- logId
- badgeId
- status: 'posted' | 'reversed' | 'pending'
- idempotencyKey
- metadata

建议 eventType 枚举：

- daily_valid_log
- daily_primary_goal_progress
- goal_completed_7_day
- goal_completed_21_day
- official_plan_completed
- official_verification_approved
- perfect_streak_bonus
- admin_adjustment
- reward_redemption
- reversal

### 7.4 官方计划模板

建议新增 OfficialPlanTemplate 表：

- id
- slug
- title
- subtitle
- goalType
- totalDays
- description
- verificationMode
- evidenceSchema
- completionPoints
- verificationPoints
- perfectBonusPoints
- badgeDefinitionId
- joinStartAt
- joinEndAt
- isPublished

用户创建官方计划时，Goal 会引用 officialPlanId。

### 7.5 徽章定义和用户徽章

建议新增两张表：

#### BadgeDefinition

- id
- code
- title
- subtitle
- family
- level
- rarity
- iconType
- isOfficial
- metadata

#### UserBadge

- id
- userId
- badgeDefinitionId
- goalId
- officialPlanId
- issuedAt
- status
- verificationStatus
- metadata

## 8. 接口设计

### 8.1 用户侧接口

建议新增：

- GET /api/rewards/profile
- GET /api/rewards/ledger
- GET /api/badges
- GET /api/official-plans
- POST /api/goals/:id/set-primary
- POST /api/goals/:id/submit-verification
- POST /api/goals/:id/evidence

### 8.2 管理侧接口

建议新增：

- GET /api/admin/verifications
- POST /api/admin/verifications/:id/approve
- POST /api/admin/verifications/:id/reject
- POST /api/admin/official-plans
- PUT /api/admin/official-plans/:id

### 8.3 与当前接口的衔接点

现有关键逻辑在这些位置：

- [server/routes/logs.js](server/routes/logs.js)
- [server/routes/goals.js](server/routes/goals.js)
- [server/services/goalService.js](server/services/goalService.js)
- [types.ts](types.ts)
- [components/GoalPlanner.tsx](components/GoalPlanner.tsx)
- [components/History.tsx](components/History.tsx)

建议改造方式：

1. 在日志保存成功后，按服务端日期执行积分结算。
2. 在计划完成时，不直接一把梭发完所有奖励，而是根据 planScope 和 verificationMode 分流。
3. History 中现有的 goalBadges 可继续保留，同时增加 earnedPoints 标记。
4. GoalPlanner 中现有 active goal 卡片增加“官方”“可奖励主计划”“待认证”标识。

## 9. 前端展示建议

### 9.1 GoalPlanner

在 [components/GoalPlanner.tsx](components/GoalPlanner.tsx) 中建议新增：

- 计划类型切换：个人计划 / 官方计划
- 主计划标记：当前参与积分结算
- 预计奖励预览：完成可得多少积分、什么徽章
- 认证状态徽章：待提交、待审核、已通过、已驳回

### 9.2 History

在 [components/History.tsx](components/History.tsx) 中建议新增：

- 对已结算积分的日志显示“+2”“+1”等轻量标签
- 对官方认证相关日志显示“认证材料”或“官方计划”标签

### 9.3 成就页或分析页入口

当前导航没有独立“成就”页，建议先轻量落在分析页顶部：

- 当前总积分
- 本周获得积分
- 最新获得徽章
- 官方认证通过次数

后续如果内容变多，再单独拆“成就”页面。

## 10. MVP 落地顺序

### Phase 1

先做最小可用闭环：

- 成长积分账户
- 积分台账
- primaryRewardGoal
- 个人计划完成积分
- 个人完成徽章

这一步就能先把“完成计划奖励积分”跑通。

### Phase 2

再做官方计划：

- OfficialPlanTemplate
- 官方计划创建入口
- 官方计划徽章
- 自动认证

### Phase 3

最后做官方审核：

- 认证材料上传
- 审核后台
- 人工审核流
- 认证积分和认证徽章发放

## 11. 我建议你优先采用的方案

如果只选一版最稳的，我建议这样落：

1. 保留现在的多计划并行机制，不改用户体验。
2. 新增一个 primaryRewardGoal，只有它参与积分与完成奖励结算。
3. 积分只奖励“每日有效记录 + 主计划完成 + 官方认证通过”。
4. 普通个人计划给轻量完成徽章。
5. 官方计划分成“完成”和“认证”两个阶段，认证通过再发高价值官方徽章。
6. 所有奖励结算一律使用服务端日期，不再信任客户端 timestamp。

这版的优点是：

- 能兼容当前现有代码结构。
- 反作弊足够明确。
- 以后能平滑扩展成官方挑战、训练营、课程营和兑换体系。
