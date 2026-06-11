# Claude Review Issues — V2 Cloud Monitoring Full Replacement

文档版本：v1.0  
评审日期：2026-06-11  
评审对象：`FormAlert_Commercial_Architecture_Review_v2.md`（Draft v0.1）  
评审前提：**V2 Cloud Monitoring 全面替换 Apps Script 执行模式**。Apps Script 仅保留为 Add-on UI 入口、OAuth 发起、Form 注册提交和轻量状态展示。  
评审角色：高级产品经理 + Google Workspace 插件架构 + 隐私安全

---

## 1. Overall Verdict

在「V2 全面替换 Apps Script 执行」这一产品决策确立后，原文在技术架构、数据安全和容量规划方面整体质量较高，核心组件（Pub/Sub ingress → job queue → worker → cursor → 幂等 → KMS）方向正确，可以进入 PoC。

但原文**内嵌大量双轨策略、Local Mode 和回退 Apps Script 的表述**，这些内容与新决策直接冲突，若不删除或改写将在开发过程中造成理解分歧和实现错误。

此外，存在若干 P0 级别的遗漏：Apps Script 的新职责边界没有正面说清楚；「首次 Save 即 Cloud Monitoring」与「手动 Enable cloud monitoring」的语义矛盾未解决；`forms.body.readonly` 是否属于 Restricted scope 必须在 PoC 前确认，否则 CASA 审核可能令整个上线时间线失控。

**结论：允许进入 PoC，但必须先完成第 2 节「方向性改写」和第 3 节 P0 问题修复，才可进入正式开发。**

---

## 2. Required Direction Changes

以下内容与「V2 全面替换 Apps Script 执行」直接冲突，必须从原文中删除或改写。

| ID | 原文位置 | 原文方向 | 冲突原因 | 必须改写为 |
|---|---|---|---|---|
| DC-01 | §0 推荐产品结论表第 1 行 | 「保留 V1.6 Apps Script 模式，同时研发 V2 Cloud Monitoring」 | 明确保留旧执行模式，与新决策相反 | 「V2 Cloud Monitoring 全面替换 Apps Script 执行模式；Apps Script 仅作为 UI 和 OAuth 入口」 |
| DC-02 | §13.1 标题及正文 | 「推荐双轨策略」「不要立即删除 V1.6 Apps Script 执行模式」「V1 Local Mode：保留当前 Apps Script trigger 路径」 | 整节内容完全基于双轨假设 | 删除 §13.1 全文；替换为「V2 全面替换说明」：Apps Script 不再创建 installable trigger，不再执行 filter、渲染、Slack 发送 |
| DC-03 | §13.2 迁移原则最后一条 | 「支持回退到 Local Mode，但回退时需要重新创建 Apps Script trigger」 | 提供了回退到旧执行路径的选项 | 删除该条；改写为「V2 无回退模式；若用户撤销 OAuth，FormAlert 停止所有后台处理，需重新连接」 |
| DC-04 | §13.3 第 2 条 | 「不使用 FormAlert server 处理 response」 | 这是对 AGENTS.md 旧约束的描述，V2 已改变该约束 | 改写为「V2 已获批准：response 在 worker 内存中短暂处理，AGENTS.md 必须同步更新」 |
| DC-05 | §17 Phase 0 第 6 条 | 「确认 Local Mode 与 Cloud Monitoring 是否长期双轨」 | 该决策已确定，不再需要确认 | 删除该条；替换为「确认 Apps Script 新职责边界：仅 UI + OAuth + 提交注册，不创建 trigger，不执行 response 处理」 |
| DC-06 | §18 DG-06 | 「是否保留 V1 Local Mode → 推荐：保留，用户主动迁移」 | 推荐与新决策相反 | 改写为「DG-06 已确认：不保留 V1 Local Mode；V2 为唯一执行模式；已有 Apps Script trigger 的用户须在首次注册时删除旧 trigger」 |
| DC-07 | §18 DG-06 | 「5. 只有 DG-01、DG-02、DG-03、DG-05 和 DG-06 明确后，才进入正式开发」中 DG-06 的判断标准 | DG-06 已确定，不再是待判断门槛 | 更新为「DG-06 已确认为全面替换；移入已确认列表」 |
| DC-08 | §19 风险清单末行 | 「双轨模式造成重复发送 → 缓解：迁移时先停旧路径」 | 以双轨为前提的风险 | 改写为「现有 V1 用户迁移时若 Apps Script trigger 未删除会造成重复发送 → 缓解：注册流程中强制检测并删除现有 Form 的 installable trigger」 |
| DC-09 | §21 联合评审流程第 1 条 | 「产品经理确认……双轨策略」 | 该决策已确定 | 删除「双轨策略」，替换为「确认 Apps Script 职责边界与新用户注册触发时机」 |

---

## 3. Critical Issues

### P0 — 不修复无法进入 PoC，或将导致方向错误 / 审核重大风险

| ID | Severity | Area | Issue | Impact | Required Fix |
|---|---|---|---|---|---|
| CI-01 | P0 | 产品边界 | 原文未在任何一处**正面声明** Apps Script 不再创建 installable Form submit trigger，不再执行 Filter、模板渲染、Slack Webhook 发送 | 开发者无法确定 Apps Script 代码的最终边界，可能保留旧执行路径 | 在 §8.2 组件表中为「Google Forms Editor Add-on」一行明确列出「不再做」的事项：不创建 trigger、不执行 filter、不发送 Slack、不在本地存 Webhook |
| CI-02 | P0 | 用户流程 | §5.1 步骤 3 写「用户点击 `Enable cloud monitoring` 或首次 Save」，暗示两种路径并存，且「首次 Save」触发 OAuth 的 UX 完全没有设计 | 开发者会实现两套分支；用户体验混乱 | 确定唯一入口：**首次 Save = 触发 OAuth + 注册 + 创建 watch**，没有单独的「Enable」按钮；或反之保留「Enable」按钮作为唯一入口，并在 Save 前校验已连接 |
| CI-03 | P0 | 安全 / 审核 | `forms.body.readonly` 是否属于 **Restricted scope** 未确认。若属于 Restricted，Google 要求提交第三方 CASA（Cloud Application Security Assessment）安全审计，费用数千美元，周期 2–6 个月 | 可能导致 V2 GA 延迟数月 | **PoC 开始前**在 Google Cloud Console 和 OAuth verification 指引中确认该 scope 分类；若为 Restricted，立即准备 CASA 审计方案 |
| CI-04 | P0 | 隐私 / 法律 | 网站、Privacy Policy、Marketplace disclosure 当前写明「response 和 Webhook 不进入服务器」。V2 上线后若未同步修改，构成对用户的虚假隐私承诺，可能违反 Google Marketplace 政策和 GDPR | 被 Google 下架或用户投诉 | 在进入 PoC 前，起草新版 Privacy Policy 草稿并锁定改写范围；V2 GA 前必须完成所有公开文案更新，取得用户主动同意 |
| CI-05 | P0 | 迁移 | 原文 §13.2 迁移原则仅服务双轨场景。在全面替换模式下，现有已安装 FormAlert 并设置了 Apps Script installable trigger 的用户，迁移流程完全缺失 | 若遗漏旧 trigger 删除，同一 Form 的 response 会同时触发 Apps Script 发送和 V2 Worker 发送，造成重复 Slack 消息 | 新增「存量用户迁移流程」章节：注册 /v2/forms/register 时，后台须告知 Add-on 检测并删除现有 Form 的 installable trigger；Add-on 须显示迁移确认弹窗 |

### P1 — 不修复会影响开发、稳定性、隐私或商业化

| ID | Severity | Area | Issue | Impact | Required Fix |
|---|---|---|---|---|---|
| CI-06 | P1 | 产品流程 | §5 仅定义首次启用流程，**未定义配置变更流程**：用户已连接后，在 Add-on 中修改 Webhook / 模板 / Conditions，如何同步到后台？同步是实时的还是 Save 时触发？ | 后台存储的配置可能与用户在 Add-on 里看到的内容不一致 | 在 §5 补充「配置更新流程」：用户在 Add-on 编辑并点击 Save → Add-on 调用 `PUT /v2/forms/:formId/config` → 后台更新加密配置 → 返回成功 |
| CI-07 | P1 | 产品流程 | 「Test message」在 V2 中如何运行没有定义。原 V1 测试在 Apps Script 本地执行；V2 全面替换后，`/v2/forms/:formId/test` 对应的完整行为（是否使用 Forms API 拉取最新 response、是否执行完整 filter + 渲染 + Slack 发送）完全缺失 | 测试功能无法开发；用户在 Add-on 中点击 Test 后行为不确定 | 新增 `POST /v2/forms/:formId/test` 功能说明：从 Forms API 拉取最新 1 条 response → worker 执行 filter + 渲染 → 向 Slack 发送并打上「[Test]」标记 → 返回结果；测试不计入配额 |
| CI-08 | P1 | 架构 | 数据模型中 `forms` 表缺少 `delivery_issue` 状态，§6.8 状态表中有 `Delivery issue` 但 `forms.status` 字段定义里没有 | 状态机不完整，worker 无法将 Delivery issue 持久化为 Form 级别状态 | 在 `forms.status` 枚举中增加 `delivery_issue` |
| CI-09 | P1 | 架构 | `forms.responses.list` 有分页机制（`pageSize` + `nextPageToken`），原文 §6.5 cursor 算法只描述了 overlap 和排序，**未说明 Worker 如何处理分页**：是否循环拉取所有页直到 `nextPageToken` 为空？ | 一次触发对应多条 response 时，只处理第一页会漏 response | 在 §6.5 补充分页说明：Worker 在单次 job 执行中循环分页拉取，直到 `nextPageToken` 为空，再推进 cursor |
| CI-10 | P1 | 架构 | Add-on 调用 Control Plane API 时使用的**认证机制未明确**。§12.3 只写「短期签名 token 或经过验证的 Google identity」，但 Apps Script 获取 Google identity token 的具体方式（`ScriptApp.getIdentityToken()` + JWT 验证）没有说明 | 实现时可能使用不安全方案（如静态 API key 硬编码在 Apps Script 中） | 在 §12.3 明确：Add-on 使用 `ScriptApp.getIdentityToken()` 获取短期 OIDC token，Control Plane 验证 audience 和 `sub` 与已注册账号匹配 |
| CI-11 | P1 | 产品 | §4.2 套餐表缺少 **Free 套餐在 V2 中是否支持 Cloud Monitoring** 的明确说明。Free 只有 1 Form / 30 sends，但是否走 V2 worker 处理？若走，运营成本与隐私披露同样适用 | Free 用户使用体验和隐私声明存在歧义 | 明确 Free 套餐是否走 V2 Cloud Monitoring（推荐：Free 也走 V2，统一架构，无 V1 路径） |
| CI-12 | P1 | 产品 | §4.2 套餐表中「Free：30/月或现有 Free credits 规则」的计费规则**与 V1 不同**（V1 是全生命周期 30 次，V2 建议是每月 30 次），但原文没有明确是「每月」还是「累计」 | Pricing 页面文案会写错；影响用户决策 | 明确 Free 计费窗口：推荐「每月重置 30 次」，在 §4.2 和 Pricing 页面统一表述 |
| CI-13 | P1 | 安全 | §9.5 `alert_configs` 中写「模板是否必须加密需由安全评审确认」，表述仍为待决状态 | 开发时可能不加密模板，但模板含业务敏感字段（客户邮箱格式、关键字等） | 将「推荐加密」升级为「必须加密」，删除待评审说明；与 refresh token、Webhook 统一处理 |
| CI-14 | P1 | 安全 | 原文未说明 APM / 错误追踪工具（如 Sentry、Datadog）的**配置要求**：这类工具默认会上报完整请求上下文，可能捕获 response 内容或 token | response 意外进入第三方 APM，违反隐私承诺 | 在 §11.4 补充：所有 APM / 错误追踪工具必须启用 data scrubbing，禁止上报 request body / response body / Authorization header；定期审计 APM 数据 |
| CI-15 | P1 | 产品 | §11.5 支持「用户删除 FormAlert Account」，但**没有指定 UI 入口**：Add-on 里没有账号管理入口，网站又不做 Dashboard | 用户无法自助删除账号，违反 GDPR 删除权 | 明确账号删除入口：推荐在 Support 页面提供 email 申请入口 + 自动化流程；或在 Add-on 中增加「Disconnect FormAlert Account」选项 |

---

## 4. Product Gaps

### 4.1 用户启用流程

- **缺少 Watch 创建失败时的 Setup failed 恢复流程**：§6.8 定义了 `Setup failed` 状态，但 §5 用户流程中没有「用户如何从 Setup failed 恢复」的步骤。建议补充：点击「Fix setup」→ 后台重试 watch 创建 → 成功后变为 `Connected`。
- **缺少多 Google Account 的 UX 说明**：§6.1 提到「支持 Google 多账号场景」，但未说明：一个 FormAlert Account 是否只能绑定一个 Google Account？若用户有 Google Account A 和 B 各有 Forms，能否全部连接？

### 4.2 Add-on UI 职责

原文 §8.2 组件表只列出 Add-on 「做什么」，未列出 Add-on 「不再做什么」。必须补充明确项：

| 职责 | V2 状态 |
|---|---|
| 配置 UI（Webhook、模板、Conditions） | Add-on 仍负责，Save 时提交到 Control Plane |
| 字段变量选择器（读当前 Form questions） | Add-on 仍负责，通过 Forms API 本地读取或从 Control Plane 拉取 schema |
| 发起 OAuth | Add-on 负责 |
| 展示 Dashboard（Form 列表、状态） | Add-on 负责，数据从 Control Plane API 读取 |
| 创建 installable Form submit trigger | **V2 不做，删除** |
| 执行 Filter 规则判断 | **V2 不做，由 Worker 执行** |
| 模板渲染 | **V2 不做，由 Worker 执行** |
| Slack Webhook 发送 | **V2 不做，由 Worker 执行** |
| 本地存储 Webhook / 模板 / Conditions | **V2 不做，配置提交到后台加密存储** |
| Test with Latest Response | **V2 由后台 `/v2/forms/:formId/test` 执行** |

### 4.3 Dashboard 状态

- 原文缺少「当前套餐已满，无法再启用新 Form」的状态或提示。用户在 Business 已用满 100 Forms 时，尝试注册第 101 个 Form 时的 UX 未定义。
- `Setup failed` 与 `Needs reconnect` 对用户而言视觉相似，但修复动作不同（前者是重试 watch，后者是重新 OAuth）。建议在文档中区分用户可见文案。

### 4.4 Pricing / Plan Limits

- Free 套餐的 30 次/月与 V1「30 次累计」不同，需要在 Pricing 页面更新。
- V2 架构下，所有套餐（包括 Free）都使用 Cloud Monitoring，运营成本需重新核算定价可行性。

### 4.5 Pause / Resume / Delete

- Resume 流程缺少：若套餐已满（Enabled Forms 已到上限），Resume 应返回明确的套餐限制提示，而非静默失败。
- Delete 流程缺少：若 Delete 时 watch 删除 API 调用失败，是否阻止 DB 侧的配置删除？需明确：watch 删除失败时，DB 侧的 Form 记录仍应标记为 deleting，后台异步清理。

### 4.6 Debug

- §6.9 Debug 最近 10 条是否按 Form 维度还是账号维度？原文表述「用户级 Debug」含义模糊。推荐明确为：每个 Form 独立维护最近 10 条脱敏 Debug 条目，通过 `/v2/forms/:formId/debug` 获取。

### 4.7 用户隐私提示

- 首次 OAuth 授权页面应向用户展示「FormAlert 将如何处理您的 Form response」的简明说明（不是法律文本）。原文 §11.1 只说「网站 Privacy Policy 必须修改」，但没有说明**在 OAuth 同意界面本身需要展示什么信息**。

### 4.8 Marketplace 文案

- Marketplace 的 Permissions 说明（安装时弹出的权限列表）必须与 `forms.responses.readonly`、`forms.body.readonly` 一致；当前 Marketplace 文案如仍写「我们不读取您的 Form response」，会在 Google 审核时被拒绝。

---

## 5. Technical Architecture Gaps

### 5.1 OAuth

- **access token 缓存策略未定义**：Worker 调用 Forms API 前需要有效 access token（1 小时有效）。原文未说明 Worker 是否缓存 token、何时刷新、多个并发 Worker 是否有 token 刷新竞争。建议：每次 job 执行时，Worker 先检查 `last_refresh_at` 是否在 50 分钟内，否则调用 Token Refresh API，并以悲观锁或 DB CAS 防止并发刷新冲突。

- **多 Google Account 的 credential 表结构**：`google_credentials` 按 `account_id` 一对一，若一个用户的不同 Forms 属于不同 Google Account，当前数据模型无法支持。需明确：一个 FormAlert Account 是否只能绑定一个 Google Account。

### 5.2 Forms Watch

- **watch 续订窗口与 Forms API Write quota 的关系**：续订是写操作（`forms.watches.renew`），每分钟每项目 375 次。若 100,000 个 watches 集中续订（大量用户同时到 48h 窗口），有超额风险。建议在续订调度中追加全局 rate limiter，并在原文 §6.4 续订策略中说明。

- **watch create 时 `targetResource` 的权限依赖**：创建 watch 需要用户对 Form 有 Editor 权限（不是只有 Viewer 权限），这一点在原文中未提及。如果用户只是 Form 的 Viewer，watch 可能创建失败。需在 §6.2 Form 注册中说明权限要求，并在 Setup failed 流程中提示用户。

### 5.3 Pub/Sub

- **Pub/Sub push 认证中 audience 字段**：推送到 Ingress 时，Pub/Sub push 使用 Google 签发的 OIDC token，audience 是 Ingress 的 URL。原文 §12.3 提到了验证，但没有说明如何在 Cloud Console 配置 push subscription 的 service account 和 audience。PoC 中需明确配置步骤。

### 5.4 Job Queue

- **Job coalesce 边界**：原文说「同一 Form 合并并发通知，只保留一个 active fetch job」，但没有说明：若 Form A 有 1 个 running job 且其 lease 快到期，此时又来一条通知，是否需要 upsert 一个 queued 状态的后续 job？否则当前 job 完成后不会再次拉取新 response。建议：job 完成时检查是否有 pending 通知到达，如有则立即创建新 job。

- **job 最大重试次数与 dead-letter 阈值**：`processing_jobs` 表有 `attempt_count` 但原文未定义最大重试次数（例如 5 次）。超过后进入 dead-letter 状态，且对应 Form 应标记 `delivery_issue`。

### 5.5 Worker

- **响应分页处理**：`forms.responses.list` 返回 `nextPageToken` 时，Worker 必须在同一 job 执行中循环拉取所有页，否则会漏 response。原文未提及。

- **单 Form 并发保护机制**：原文说「同一 Form 同时只允许一个 response fetch job 执行」，但没有说明具体实现：推荐使用 `processing_jobs` 表中的 `unique(form_id)` 约束配合 `status IN (queued, running)` 过滤，或 PostgreSQL advisory lock。

- **Worker 内存 response 清除的时机**：原文 §5.2 步骤 11 写「Worker 清除内存中的 response 内容」，但清除时机不明确：是每条 response 处理完立即清除，还是整个 batch 完成后统一清除？推荐：每条 response 处理完（无论匹配或 skipped）立即 dereference，不等待整批完成。

### 5.6 Cursor / Overlap

- **cursor 推进失败的恢复**：原文 §6.5 说「处理失败，不推进到会造成漏处理的位置」，但没有说明 cursor 推进本身失败时（DB 写入失败）的处理。推进 cursor 必须与 response 幂等写入在**同一数据库事务**中完成，否则出现重复处理。

### 5.7 Slack Retry

- **Retry-After 头的最大等待时间**：Slack `429` 的 `Retry-After` 理论上可以很长。原文说「遵守 Retry-After」但未设上限。若 Retry-After = 3600，job 应进入长时间退避，不应占用 worker slot。建议设置最大等待时间（如 30 分钟），超过则标记 `retryable_error` 并推迟 available_at。

### 5.8 Encryption

- **加密密钥轮换时的 zero-downtime 策略**：原文 §11.2 提到「定期轮换 KEK，并验证重加密流程」，但没有说明如何在不停机的情况下完成轮换（新 KEK 包装新 DEK，旧数据逐步重加密，支持同时读取旧 wrapped DEK）。需在安全章节补充轮换方案。

### 5.9 IAM

- **Add-on 到 Control Plane 的认证方式**：§12.3 说「短期签名 token 或经过验证的 Google identity」，但 Apps Script 的 `ScriptApp.getIdentityToken()` 默认 audience 是项目 client ID，Control Plane 必须验证正确的 audience + `sub` 与 FormAlert account 绑定。此实现细节不明确，PoC 中需先验证。

### 5.10 Observability

- **响应处理 P95 延迟的拆解**：原文 §7.1 SLO 定义了端到端 P50/P95，但没有定义各段延迟的拆解指标（Google watch 通知延迟、Pub/Sub push 延迟、job queue 等待时间、Worker 处理时间、Slack 网络延迟）。若不拆解，P95 超标时无法定位瓶颈。

### 5.11 Deletion

- **deletion 的原子性**：Delete 时需要同时删除 watch（外部 API）、DB 记录、KMS DEK。若 watch 删除成功但 DB 删除失败，系统需要能够在下次健康扫描中识别「DB 无对应 Form 但 watch 仍存在」并清理。需在 Scheduler 的健康扫描中加入孤立 watch 检测逻辑。

---

## 6. Privacy / Security / Compliance Gaps

### 6.1 OAuth Verification 风险

| 风险 | 严重度 | 说明 |
|---|---|---|
| `forms.responses.readonly` scope 分类 | High | 该 scope 通常归为 Sensitive，需提交 OAuth Verification，但**无 CASA 要求**；需在 Google Cloud Console 确认 |
| `forms.body.readonly` scope 分类 | **Critical** | 该 scope 可能归为 Restricted，需提交 CASA（第三方安全审计），费用数千美元，周期 2–6 个月；**必须在 PoC 开始前确认** |
| OAuth Verification 材料准备周期 | High | 即使只有 Sensitive scope，Google 审核周期为数周至数月；需在 PoC 开始后立即并行准备 |
| Consent Screen 的 data use description | High | 必须准确描述每个 scope 的用途；若描述与实际用途不符，会被 Google 拒绝 |

### 6.2 GDPR / 数据处理协议

- 若服务向 EU 用户提供，FormAlert 作为「数据处理者」需要与用户（数据控制者）签订 DPA（Data Processing Agreement）。原文未涉及。
- OAuth token、Form 配置（可能包含用户业务信息的 Filter conditions）属于个人数据范畴，需在 Privacy Policy 中声明数据处理依据（通常是「合同履行」或「合法利益」）。

### 6.3 APM / 第三方工具数据泄露

- Sentry / Datadog / New Relic 等工具在默认配置下会捕获请求 body 和 response body。原文只说「日志中禁止出现 response 内容」，但未涵盖 APM。
- **必须在 §11.4 补充**：所有接入的 APM 工具须配置 `denyUrls` / `beforeSend` hook / scrubbing 规则，明确排除 `Authorization`、`X-Goog-*`、所有 `/v2/forms/*/` 请求 body。

### 6.4 日志字段白名单 vs 黑名单

- 原文采用「禁止出现」黑名单方式，但实践中难以穷举所有敏感字段。
- 建议采用**白名单日志字段**：只允许记录预定义的安全字段（如 `accountId hash`、`formId hash`、`operation`、`status code`、`elapsed_ms`），其余一律不记录。

### 6.5 Pub/Sub 消息内容安全

- Google Forms watch 通知的 Pub/Sub 消息不含 response 内容，但消息属性中有 `formId`。Pub/Sub 消息内容本身通过 TLS 传输，但若 Pub/Sub Ingress 意外记录原始 push message，需确认 push message 中无敏感信息。

### 6.6 KMS KEK 访问审计

- 原文未要求对 KMS 解密操作进行访问审计日志。Google Cloud KMS 默认记录 admin activity，但 data access（decrypt 操作）默认**不开启审计日志**，需手动启用 Cloud Audit Logs → Data Access。

### 6.7 Forms API `forms.body.readonly` 读取的数据范围

- `forms.body.readonly` 可读取 Form 的完整结构，包括 Form description、section 标题等。若 Form description 含有用户业务敏感信息，后台在同步 schema 时可能读取到超出必要范围的数据。
- 建议只存储 question title 和 question type（即 `form_questions` 表当前的字段），不存储 Form description 或 section 内容。

---

## 7. PoC Checklist

以下是进入正式开发前必须通过的 PoC 验证项，按优先级排序。

### P0 — 阻塞项，必须先于其他所有 PoC 验证

| # | 验证项 | 通过标准 |
|---|---|---|
| POC-01 | 确认 `forms.body.readonly` scope 分类 | 从 Google Cloud Console OAuth verification 页面确认是 Sensitive 还是 Restricted；若 Restricted，启动 CASA 准备 |
| POC-02 | Add-on 到 Control Plane 认证可行性 | Apps Script `ScriptApp.getIdentityToken()` 生成的 OIDC token 能被 Control Plane 正确验证，audience 和 `sub` 匹配 |
| POC-03 | 存量 V1 trigger 检测与删除 | Add-on 能检测当前 Form 是否有 installable Form submit trigger，并在注册到 V2 时删除；需测试 trigger 已存在和不存在两种场景 |

### 核心技术验证

| # | 验证项 | 通过标准 |
|---|---|---|
| POC-04 | OAuth offline access 稳定性 | refresh token 稳定获取，连续 48 小时内自动刷新 access token 成功 |
| POC-05 | `forms.responses.readonly` watch + response list | watch 创建成功，response 提交后 Worker 可通过 Pub/Sub 通知触发拉取 |
| POC-06 | `forms.body.readonly` schema 同步 | Form title 和 question title 可后台读取并存入 `form_questions` 表 |
| POC-07 | 分页拉取 response | 单 Form 超过单页（如 100+ 条 response）时，Worker 循环分页拉取，无漏 response |
| POC-08 | Cursor overlap 无漏处理 | watermark 边界前后各 120 秒，同秒多条 response 均被处理，无重复 Slack 发送 |
| POC-09 | 同一 Form 单 active job 约束 | 重复 Pub/Sub 通知触发时，只有 1 个 job 在执行，其余被 coalesce |
| POC-10 | Worker 崩溃后 lease 恢复 | Worker 在 Slack 发送后、DB 写入前崩溃 → lease 超时 → 新 Worker 接管 → 幂等跳过已发送 response |
| POC-11 | 100 Forms watch 并发注册与 14 天续订 | 100 个 Form watch 创建成功；14 天内所有 watch 均在到期前自动续订 |
| POC-12 | KMS 加解密可用性 | refresh token、Webhook、模板 KMS 加密存储；Worker 能成功解密并使用；删除账号后 DEK 被删除或作废 |

### 安全与隐私验证

| # | 验证项 | 通过标准 |
|---|---|---|
| POC-13 | response 不落库、不进日志、不进 APM | 用脚本扫描 DB、日志输出、APM 数据，确认无 response value、Webhook 明文、token 明文 |
| POC-14 | Pub/Sub push OIDC 验证 | Ingress 拒绝非 Google 签发的请求；拒绝 audience 不匹配的请求 |
| POC-15 | IAM 最小权限验证 | Ingress service account 不能解密 Webhook；Support account 不能解密任何 secret |
| POC-16 | 完整删除流程 | 删除账号后 watch、token、Webhook、模板、cursor 全部清除，验证无残留 |

### 容量验证

| # | 验证项 | 通过标准 |
|---|---|---|
| POC-17 | Forms API quota 多租户共享 | 模拟 10 用户各 10 Forms 同时触发，无 429 或已有 429 退避后全部完成 |
| POC-18 | Slack 429 队列积压恢复 | Slack 返回 429 + Retry-After=60s，60 秒后 Worker 自动重试并成功发送 |

---

## 8. Revised V2 Architecture Principle

以下为修订后的 V2 架构原则，应替换原文 §8.1 全文。

---

**FormAlert V2 Cloud Monitoring 架构原则**

**架构定位**：V2 Cloud Monitoring 是 FormAlert 的唯一执行模式。Apps Script 不再创建 installable trigger，不再执行 filter 判断、模板渲染或 Slack 发送，不再在本地存储 Webhook、模板或 Conditions。Apps Script / Google Forms Add-on 的职责仅限于：提供配置 UI（Webhook、模板、Conditions）、发起 Google OAuth 授权、将当前 Form 的 `formId`、question schema 和配置提交至 Control Plane，以及展示后台返回的连接状态和 Debug 信息。

**数据处理**：Google Form response 仅在 Response Worker 内存中短暂处理，用于 filter 匹配和模板渲染，处理完成后立即释放，绝不写入数据库或日志系统。任何持久化数据中均不得包含 response 内容或 respondent 信息。

**Secret 存储**：OAuth refresh token、Slack Webhook URL、Message/Payload template、Filter Conditions 必须使用 KMS envelope encryption（AES-256-GCM）应用层加密后才能写入数据库。数据库中只保存 ciphertext 和 wrapped DEK，任何运维账号和日志系统均不可解密。

**后台职责**：Control Plane 负责账号管理、套餐校验、Form 注册与配置管理；Watch Manager 负责创建、续订、修复 Google Forms API watch；Pub/Sub Ingress 负责接收通知、快速 ACK 并写入 durable job；Response Worker 负责拉取 response（含分页）、执行幂等、filter 判断、模板渲染、Slack 发送和状态记录；Scheduler 负责 watch 续订健康扫描和 dead-letter 告警。

**事件一致性**：所有外部事件（watch 通知、Pub/Sub push）按 at-least-once 设计。通过 response 幂等表（`formId + responseId` 唯一约束）、Form 级 job coalesce 和 cursor overlap 共同保证 response 不漏处理且极低概率重复。Slack 端接受极小概率重复（因 Incoming Webhook 无业务幂等键），不对外承诺 exactly-once。

**Dashboard 数据源**：Dashboard 只展示用户已主动注册到 FormAlert 后台的 Forms，不扫描、不枚举用户 Google Drive 中的所有 Forms。

**权限原则**：只申请 `forms.responses.readonly`（watch 创建 + response 拉取）和 `forms.body.readonly`（schema 同步），不申请 Google Drive、Gmail、Form 编辑或任何非必要 scope。

---

## 9. Decision Gates 固化建议

以下 Decision Gates 已由本次产品决策确认，建议在原文 §18 中标记为「已确认」并记录决策日期：

| ID | 决策 | 确认结论 | 备注 |
|---|---|---|---|
| DG-01 | response 在后台内存短暂处理 | **已确认：接受** | V2 全面替换前提下必须接受 |
| DG-02 | 后台加密保存 Webhook / 模板 | **已确认：允许，KMS 加密** | 同上 |
| DG-03 | 申请 `forms.body.readonly` | **已确认：申请** | 须先确认 scope 分类（POC-01） |
| DG-04 | Pause 释放套餐名额 | **已确认：释放** | |
| DG-05 | response 更新不重发 | **已确认：首版不重发** | |
| DG-06 | 是否保留 V1 Local Mode | **已确认：不保留，V2 全面替换** | 原文推荐「保留」与此冲突，必须改写 |
| DG-07 | 是否开发 Web Dashboard | **已确认：本阶段不开发** | |
| DG-08 | Pub/Sub push ingress | **已确认：push + durable job** | |
| DG-09 | PostgreSQL 选型 | **待确认**：推荐 Neon（与现有 Next.js 栈一致）；需评估 Cloud KMS 与 Neon 集成可行性 | |
| DG-10 | Business 100 Forms 公开时间 | **已确认：Private Beta 验证后** | |

---

*本文档由 Claude 于 2026-06-11 基于 `FormAlert_Commercial_Architecture_Review_v2.md`（Draft v0.1）完成评审，评审前提为 V2 全面替换 Apps Script 执行模式。评审结论仅供参考，实施决策须由产品与研发负责人最终确认。*
