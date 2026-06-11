# FormAlert 联合评审结论与落地开发方案

文档版本：v1.0  
创建日期：2026-06-11  
评审对象：`FormAlert_for_Slack_PRD.md`（v1.0）与 `FormAlert_Commercial_Architecture_Review_v2.md`（Draft v0.1）  
评审角色：产品经理、研发负责人  
文档状态：**已确认，可作为后续开发依据**

---

## 0. 一句话结论

**V2 云端监控架构技术上可以落地，但不是 V1 的简单扩容，而是一次隐私边界与后端能力的升级。** 推荐采用**双轨策略**：先用 V1 Local Mode 完成 Marketplace 上架与付费验证，再并行研发 V2 Cloud Monitoring 以兑现 Business 100 Forms 承诺。在 V2 通过 PoC 与 Private Beta 之前，**不得对外承诺 Business 支持 100 个启用 Forms**。

---

## 1. 评审范围与文档关系

| 文档 | 定位 | 当前状态 |
|---|---|---|
| `FormAlert_for_Slack_PRD.md` | MVP 产品需求：过滤规则、授权码付费、Web 站职责 | v1.0，部分内容已过时 |
| `FormAlert_Commercial_Architecture_Review_v2.md` | Business 100 Forms 云端监控商业化架构 | Draft v0.1，技术方案完整，待决策门落锤 |
| 本文件 | 两份文档的联合评审结论与可执行开发方案 | **执行依据** |

**当前代码与 AGENTS.md 的实际形态**：Google Forms Editor Add-on（非 PRD 中推荐的 Sheets Add-on），V1 纯 Apps Script 本地执行，网站仅承担营销/文档/付费，不做 Dashboard。

---

## 2. 两份文档的核心冲突

### 2.1 产品形态冲突

| 维度 | PRD v1.0 | V2 架构文档 | 当前实现 |
|---|---|---|---|
| 插件入口 | Google Sheets Add-on（response Sheet） | Google Forms Editor Add-on | **Forms Editor Add-on** |
| 触发方式 | `onFormSubmit`（Sheet trigger） | Forms API RESPONSES watch + Pub/Sub | Form submit trigger（Apps Script） |
| 数据是否进服务器 | 明确不进 | Worker 内存短暂处理 | 不进（V1） |
| Webhook/模板存储 | 仅本地 Properties | KMS 加密存 DB | 仅本地 Properties |

**结论**：PRD 中 Sheets Add-on 相关章节作废。以 Forms Editor Add-on + V1 本地执行为当前基线；V2 作为 Business 套餐的独立升级路径。

### 2.2 套餐与 Forms 上限冲突

| 套餐 | PRD v1.0 | V2 架构文档 | 当前网站 `pricing.tsx` |
|---|---:|---:|---:|
| Free | 1 Form | 1 Form | 1 Form |
| Standard | 10 Forms | 20 Forms | 10 Forms |
| Business | **100 Forms** | **100 Forms** | **20 Forms** |

**结论**：

- PRD 与 V2 文档在 Business 100 Forms 上一致，但**当前 V1 架构与网站文案均无法兑现 100 Forms**。
- 网站 Business 写 20 Forms 更接近 V1 可交付能力，但与 PRD/V2 商业目标不一致。
- **落地规则**：V1 阶段 Standard 维持 10 Forms、Business 维持 20 Forms（或 Standard 上调至 20，需 PoC 前 Apps Script trigger 压测确认）；**100 Forms 仅作为 V2 Cloud Monitoring 能力，Beta 验证通过后再公开承诺**。

### 2.3 隐私承诺冲突

| 公开承诺（PRD / 当前网站） | V2 实际需要 |
|---|---|
| Response 不进入 FormAlert 服务器 | Response 在 Worker 内存中短暂处理 |
| Slack Webhook 不保存到服务器 | Webhook、模板、Conditions KMS 加密存 DB |
| 后端只存 License 与账单数据 | 还需存 OAuth refresh token、Form 配置、watch 状态、幂等记录 |

**结论**：V2 上线前必须同步更新 Privacy Policy、Landing、FAQ、Marketplace disclosure，并取得用户**主动选择启用 Cloud Monitoring** 的同意。这是 Critical 风险，不可跳过。

### 2.4 规则模型冲突

| 维度 | PRD v1.0 | V2 架构 / V1.6 实现 |
|---|---|---|
| 每 Form 规则数 | Standard 10 条 / Business 20 条 | **每 Form 1 条 Alert 配置** |
| 每规则条件数 | Standard 3 / Business 5 | Standard 5 / Business 10 conditions |
| 计费单位 | 按 Form + 规则 | 按**启用中的 Form** |

**结论**：V2 文档与 V1.6 已统一为「一 Form 一 Alert」；PRD 中「每 Form 多条 rules」需废弃或标为历史方案，避免研发与对外文案双轨。

### 2.5 定价与 V2 成本

PRD 定价：Standard $5/月，Business $8/月。  
V2 预估基础设施成本（GCP + Neon + KMS + Pub/Sub）：约 $120–280/月（早期用户量）。

**结论**：Business $8/月 在 V2 规模下难以覆盖成本。建议 V2 GA 时将 Business 调整为 **$15/月 或 $149/年**；V1 阶段可维持现有价格，因无云端 Worker 成本。

---

## 3. 产品经理评审结论

### 3.1 肯定项（V2 文档写得好、应保留）

1. **问题定义准确**：Apps Script trigger 数量、跨 Form 运维、套餐计费治理，确实是 V1 无法支撑 Business 100 Forms 的根因。
2. **双轨策略正确**：保留 V1 Local Mode，用户主动迁移至 V2，避免强制改变隐私边界。
3. **对外时效承诺克制**：「Near real-time，通常几分钟内」，不写秒级，符合 Google Forms watch 官方语义。
4. **Pause 释放名额**：比 V1.6「Paused 仍占名额」更清晰，且能降低云端成本。
5. **Decision Gates 清单完整**：10 项决策门覆盖了产品、安全、研发的关键分歧。

### 3.2 风险与缺口

1. **Business 100 Forms 是当前最大商业风险**：PRD 已对外暗示该能力，但 V1 与网站均未实现；需在定价页标注 Beta / Coming Soon，避免超卖。
2. **竞品对标需聚焦差异化**：相对 SlackNotify，FormAlert 的核心卖点是**字段过滤 + 可诊断日志**，不是「监控更多 Form」；100 Forms 是 Business 套餐的容量卖点，不是首要获客卖点。
3. **OAuth Verification 是产品上线门**：`forms.responses.readonly` 为 sensitive scope，`forms.body.readonly` 可能为 restricted scope，审核周期可达数月，应尽早并行准备。
4. **迁移体验必须原子化**：V1 trigger 与 V2 watch 并存会导致双发 Slack；迁移顺序必须是「V2 watch 就绪并收到首条通知 → 再删 V1 trigger」。

### 3.3 产品决策（已落锤）

| ID | 决策 | 结论 |
|---|---|---|
| DG-01 | Response 在后台内存短暂处理 | **接受**，须更新隐私文案 |
| DG-02 | Webhook/模板/Conditions 加密存 DB | **接受** |
| DG-03 | 申请 `forms.body.readonly` | **申请**，提前确认是否 restricted 及 CASA 要求 |
| DG-04 | Pause 是否释放名额 | **释放** |
| DG-05 | Response 更新是否重发 | **V2 首版仅首次提交发送** |
| DG-06 | 是否保留 V1 Local Mode | **长期保留**；Standard 走 V1，Business 100 Forms 走 V2 |
| DG-07 | 是否开发 Web Dashboard | **本阶段不做**，Add-on Dashboard 调用 Control Plane API |
| DG-08 | Pub/Sub push 或 pull | **Push ingress + durable job** |
| DG-09 | PostgreSQL 选型 | **延续 Neon Postgres**，不新增 Cloud SQL，降低运维分裂 |
| DG-10 | Business 100 Forms 公开时间 | **Private Beta 验证通过后再公开承诺** |

---

## 4. 研发评审结论

### 4.1 架构肯定项

1. **控制面与数据面分离**：Ingress 快速 ACK → durable job → Worker，符合 at-least-once 事件模型。
2. **Cursor + overlap（watermark - 120s）**：可消化通知延迟、合并与重复，配合 DB 幂等安全。
3. **`formId + responseId` 唯一约束 + 发送状态机**：在 Slack Webhook 无业务幂等键的前提下，已是务实最优解。
4. **KMS envelope encryption + IAM 服务账号拆分**：满足 Secret 存储安全基线。
5. **PoC 验收矩阵与 14 天容量测试**：门槛设置合理，应严格执行。

### 4.2 架构调整建议（相对 V2 原文）

| 原方案 | 调整后建议 | 理由 |
|---|---|---|
| 优先 Cloud SQL | **Neon Postgres 单库** | 与现有 Next.js + Drizzle + Vercel 栈一致；License 与 V2 表可同库不同 schema |
| 未指定 Job Queue 实现 | **pg-boss**（PostgreSQL 原生队列） | 无需 Redis/BullMQ 额外基础设施 |
| Standard 20 Forms（V2 文档） | **V1 Standard 10、V2 再评估 20** | 先以 Apps Script trigger 压测为准，避免过度承诺 |
| Business $8/月 | **V2 GA 时建议 $15/月** | 覆盖 Worker、KMS、Pub/Sub、运维成本 |

### 4.3 关键技术风险排序

1. **Watch 7 天到期 + suspended 恢复失败** → 用户静默丢通知（最高运维风险）
2. **OAuth Verification / CASA 审核周期** → 阻塞 V2 公开发布
3. **双轨迁移双发** → 用户体验与信任风险
4. **项目级 Forms API quota（responses.list 450/min）** → 多租户共享时需公平调度与限流
5. **Worker 崩溃导致极小概率 Slack 重复** → 须在 FAQ 诚实披露，不可承诺 exactly-once

---

## 5. 最终产品模型（双轨）

```text
FormAlert V1 — Local Mode（当前可交付）
├── 执行：用户 Apps Script 环境
├── 隐私：Response / Webhook / 模板不进 FormAlert 服务器
├── 套餐：Free（1 Form）、Standard（10 Forms）、Business（20 Forms，V1 上限）
├── 触发：Form submit installable trigger
└── 后端：仅 License + Creem 账单

FormAlert V2 — Cloud Monitoring（Business 扩展）
├── 执行：FormAlert 后台 Worker
├── 隐私：Response 内存短暂处理、不落库；Secret KMS 加密存 DB
├── 套餐：Business 启用最多 100 Forms（按启用中 Form 计费）
├── 触发：Forms API RESPONSES watch → Pub/Sub → Worker
├── 控制面：独立 Control Plane API（可与 Next.js 同仓不同服务边界）
└── 用户启用：Add-on 内主动「Enable Cloud Monitoring」+ OAuth 同意
```

**长期关系**：V1 不删除；V2 为可选升级。用户未启用 Cloud Monitoring 时，行为与隐私边界与 V1 完全一致。

---

## 6. 落地开发方案（分阶段）

### Phase 0：V1 正式上架（当前 ~ 2 周）

**目标**：以 Local Mode 完成 Marketplace 上架与付费闭环，不依赖 V2。

| 工作项 | 说明 |
|---|---|
| License API | 完成 `/api/license/verify`（及 activate），插件可激活 Standard/Business |
| Creem Webhook | 完成 `/api/creem/webhook`，支付成功生成并邮件发送 License Code |
| 插件验收 | `pnpm test:plugin` 全通过；Free 30 次限制、Filter、Payload、日志 |
| 定价页 | Business 不写 100 Forms；维持 20 Forms 或标注「Cloud Monitoring 即将推出」 |
| 隐私与审核 | Privacy/Terms/FAQ 按 **V1 边界** 撰写；Marketplace 最小 scope |
| Marketplace | 提交 Google Workspace Marketplace |

**Phase 0 完成标准**：用户可安装插件 → 配置 Filter → 收 Slack → 付费拿 License → 解锁套餐限制。

---

### Phase 1：V2 技术 PoC（3 ~ 5 周，与 Phase 0 后期可并行启动 OAuth 材料）

**目标**：验证能否**商业级**承诺 Cloud Monitoring，不写生产用户数据。

**基础设施**

```text
GCP 项目
├── Pub/Sub topic: forms-watch-notifications
├── Cloud Run: ingress + worker（TypeScript）
├── Cloud KMS: refresh token / webhook / template 加密
├── Neon Postgres: V2 schema（accounts, forms, alert_configs, form_watches, response_deliveries, processing_jobs）
└── pg-boss: 基于 Postgres 的 durable job queue
```

**PoC 必过项（全部通过才进入 Phase 2）**

| # | 验证项 | 通过标准 |
|---|---|---|
| 1 | OAuth offline access | refresh token 稳定获取，24h 后自动刷新成功 |
| 2 | `forms.responses.readonly` | watch 创建 + responses.list 拉取成功 |
| 3 | `forms.body.readonly` | Form title + question schema 后台同步成功 |
| 4 | 100 Forms 注册 | 100 个 watch 同时创建并持久化 expire_time |
| 5 | Watch 自动续订 | 14 天连续运行，到期前 48h 续订成功率 100% |
| 6 | 重复/合并通知 | 同 Form 重复 Pub/Sub 消息不漏处理、不大量重复 Slack |
| 7 | Cursor overlap | watermark 边界无漏 response |
| 8 | Worker 崩溃恢复 | lease 超时后接管，无大量重复 Slack |
| 9 | KMS 加解密 | DB 无明文 Secret |
| 10 | Response 不落库 | DB、日志、APM 无 response 内容 |
| 11 | 删除完整性 | Delete 后 watch、token、配置、cursor 全部清除 |

**并行启动**：OAuth Verification 材料（consent screen、scope 说明、演示视频、数据删除流程）。

---

### Phase 2：V2 商业 MVP（6 ~ 10 周，PoC 通过后）

**2-A Control Plane API（约 3 周）**

```text
POST   /v2/oauth/google/start
GET    /v2/oauth/google/callback
POST   /v2/forms/register
GET    /v2/forms
GET    /v2/forms/:formId
PUT    /v2/forms/:formId/config
POST   /v2/forms/:formId/pause
POST   /v2/forms/:formId/resume
POST   /v2/forms/:formId/reconnect
DELETE /v2/forms/:formId
GET    /v2/forms/:formId/debug
```

**2-B Ingress + Worker（约 3 周）**

- Pub/Sub push：校验 Google OIDC → 按 formId upsert job → 200 ACK
- Worker：拉取 config → responses.list(overlap) → 幂等 → Filter → 渲染 → Slack → 推进 cursor

**2-C Watch Manager + Scheduler（约 2 周）**

- 每小时：48h 内到期 watch 续订（jitter）
- 每小时：suspended watch 修复尝试
- 每天：健康扫描、dead letter 告警

**2-D Add-on 集成**

- 「Enable Cloud Monitoring」→ OAuth → register → **确认 V2 首条通知后删除 V1 trigger**
- Dashboard 数据源切换为 Control Plane API（仅已注册 Forms，不扫 Drive）

---

### Phase 3：安全、合规与 Private Beta（3 ~ 4 周）

- 完成 OAuth Verification（含 restricted scope 时的 CASA）
- 更新 Privacy / Landing / FAQ / Marketplace（V2 数据处理表述）
- Private Beta：5 ~ 10 用户，每人 ≤ 20 Forms，连续 14 天监控 SLO
- 度量 P50/P95 端到端延迟，验证 watch 续订与配额限流

---

### Phase 4：Business GA（Beta 稳定后）

- 定价页开放 Business **100 enabled Forms**（Cloud Monitoring）
- 建议调价：Business **$15/月** 或 **$149/年**
- SLO 对外：P50 < 3 分钟，P95 < 10 分钟；不承诺秒级
- On-call runbook、成本与 quota 仪表盘就绪

---

## 7. 明确不做（范围护栏）

以下能力**本阶段一律不做**，避免范围膨胀：

- Web Dashboard（网站不变成管理后台）
- Google Drive 扫描发现全部 Forms
- Slack OAuth / Bot（仅 Incoming Webhook）
- AI Rule Builder
- Response 历史查询、搜索、报表
- 嵌套 Filter（混合 AND/OR 分组）
- 单 Form 多条 Alert 配置
- Gmail / Drive scope

---

## 8. 文档与代码后续动作

| 动作 | 负责 | 优先级 |
|---|---|---|
| 将 PRD 中 Sheets Add-on、多 rules 模型标为「已废弃」或另存历史版 | 产品 | P1 |
| 定价页与 `FormAlert_for_Slack_PRD.md` 套餐表对齐 V1 可交付上限 | 产品 + 前端 | P0 |
| V2 文档 Decision Gates 状态更新为「已确认」 | 产品 | P1 |
| `AGENTS.md` 在 V2 开发批准前补充 Cloud Monitoring 边界例外说明 | 研发 | V2 启动时 |
| 新建 `docs/FormAlert_V2_Control_Plane_API.md`（Phase 2 启动时） | 研发 | P2 |

---

## 9. 评审记录

| 日期 | 评审人 | 角色 | 结论 |
|---|---|---|---|
| 2026-06-11 | AI 联合评审 | 产品 + 研发 | **通过，按本文件分阶段执行**；V2 须 PoC 门槛 + Privacy 更新 + OAuth 审核 |
| 待填写 | 待填写 | 安全/隐私 | 待 V2 PoC 前确认 KMS、日志、删除流程 |
| 待填写 | 待填写 | 运营 | 待 OAuth Verification 与 Beta 支持流程确认 |

---

## 10. 参考文档

- `docs/FormAlert_for_Slack_PRD.md` — MVP 产品需求（部分条款需按本文件修订）
- `docs/FormAlert_Commercial_Architecture_Review_v2.md` — V2 云端监控技术方案
- `docs/FormAlert_Plugin_PRD_v1_6_UI_Refined.md` — 当前插件 UI 与 Forms-first 模型
- `AGENTS.md` — 仓库边界与网站/插件职责
