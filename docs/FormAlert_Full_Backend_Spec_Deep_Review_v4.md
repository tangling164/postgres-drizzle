# FormAlert Full Backend Spec(4) — 深层次开发准入评审

评审对象：`FormAlert_Full_Backend_Spec(4).md`  
评审版本：Deep Review v4.0  
评审日期：2026-06-12  
评审目标：判断当前后端方案是否可以进入代码开发阶段。  
评审范围：Web 端购买 / 授权码发放 / 插件端 Cloud Monitoring / 授权码激活 / 账户与套餐 / Worker / 安全与合规。  
限制说明：本评审只输出方案评审意见，不提供 Codex 开发提示词，不修改原方案文档。

---

## 1. 总体结论

**结论：分阶段 Conditional GO。**

当前方案已经具备较完整的商业规则、数据模型和后端分层设计，可以作为后端开发蓝图使用，但不能将所有模块一次性进入完整代码开发。

更准确的准入判断如下：

| 阶段 | 开发准入结论 | 说明 |
|---|---:|---|
| Phase 0 前置验证 | **GO** | 可以立即进入，且必须先做 |
| Phase 1 授权码 / Creem / Free Trial / Account Bootstrap | **GO with Fixes** | 可进入开发，但必须先修复 P0/P1 中的配额扣减、License 事务、OAuth/account bootstrap 边界 |
| Phase 2 Cloud Monitoring | **PoC Only** | 只能进入 PoC，不应直接进入生产级开发 |
| Phase 3 完整 Worker / Watch / Pub/Sub 生产实现 | **NO-GO** | 需要 Phase 0 与 Phase 2 验证通过后再进入 |
| Marketplace / GA | **NO-GO** | 需要隐私文案、OAuth verification 风险、数据删除、日志脱敏策略全部闭环 |

整体判断：  
**授权码系统和套餐系统可以准备开发；Cloud Monitoring 只能先做 PoC；完整生产级 Worker 暂不应开发。**

---

## 2. 已经达到开发蓝图要求的部分

当前文档相比上一版已经明显成熟，以下部分可以视为通过：

| ID | 模块 | 评审结论 |
|---|---|---|
| PASS-01 | Free 试用规则 | 已统一为首次 OAuth/account bootstrap 后 7 天或 30 次 Slack 发送，先到者失效 |
| PASS-02 | Conditions 商业限制 | 已取消 Standard / Business 的套餐级 Conditions 限制，只保留统一安全上限 50 |
| PASS-03 | 授权码存储 | 已改为 HMAC-SHA256 hash 入库，明文只通过邮件交付 |
| PASS-04 | 订阅取消 | 已改为 subscription.cancelled 后保留到 valid_until，到期后降级 |
| PASS-05 | 退款策略 | 已明确不支持常规退款，refund/dispute 只作为支付风险事件处理 |
| PASS-06 | Business / Standard 优先级 | 已明确 Business 有效期内拒绝 Standard 授权码 |
| PASS-07 | 降级后 Form 处理 | 已支持 downgrade pause，并在重新付费后系统自动恢复 |
| PASS-08 | DELETE account | 已补充较完整的数据删除顺序 |
| PASS-09 | V2 方向 | 已删除“V1 Add-on 继续运行”的冲突表述，整体符合 Cloud Monitoring 替代 Apps Script 执行的方向 |
| PASS-10 | API 分层 | Web App 处理支付与授权码，Control Plane 处理监控、配置、激活，分工基本合理 |

---

## 3. 阻塞代码开发的关键问题

### 3.1 Free Trial 配额扣减存在竞态，当前逻辑会超发

这是目前最重要的实现风险。

文档中 Worker 逻辑是：

```text
先检查 free_trials.send_used
→ 发送 Slack
→ Slack 200 后 UPDATE send_used = send_used + 1
```

虽然文档后面增加了条件 UPDATE，但仍然是在 Slack 发送成功之后扣减。如果用户在 `send_used = 29` 时短时间内触发多个 response，多个 worker 都可能先通过前置检查并发送 Slack。之后只有部分 UPDATE 能成功，但 Slack 消息已经发出，实际发送数会超过 30。

当前文档甚至写了：

```text
若无返回行：已在并发中被耗尽，此次发送仍记录为 sent
但不再继续递增
```

这会导致产品承诺的 “30 次 Slack 通知” 无法强约束。

**建议修正：**

Free 配额应采用“发送前预占额度”模型，而不是“发送后扣减”模型。

推荐流程：

```text
1. Worker 准备发送前执行 conditional UPDATE:
   send_used < send_limit AND now() <= expires_at
2. 如果 UPDATE 成功，获得本次发送资格。
3. 再发送 Slack。
4. Slack 成功：记录 sent。
5. Slack 失败：
   - retryable error：保留该 delivery 的 retry 状态，不退还 quota，重试沿用同一 delivery。
   - permanent error：可选择不退还，或按产品规则退还；必须固定一个规则。
```

更严谨的是引入 `quota_consumed_at` 或在 `response_deliveries` 中记录 `quota_reserved=true`，避免 retry 再次扣减。

**Severity：P0**  
**影响：Free 试用规则无法被真实执行，Worker 高并发下会超发。**

---

### 3.2 License 激活事务仍有外部副作用混入事务的问题

当前文档在 `/v2/license/activate` 成功事务内执行：

```text
autoResumeDowngradePausedForms(accountId, planLimit)
```

并说明恢复后异步重建 Watch。这一方向合理，但需要注意：

1. 恢复 Form 状态属于 DB 事务内操作，可以同步执行。
2. 重建 Watch 是外部 Google API 调用，不应在同一个 DB 事务内执行。
3. 如果 DB 状态已恢复为 connected，但 Watch 重建失败，则 Dashboard 会显示 connected，但实际没有监控。
4. 当前文档虽然写“Watch 重建可异步”，但没有定义中间状态。

**建议修正：**

将恢复后的 Form 状态拆成：

```text
status = setup_pending 或 reconnecting
enabled = true
pause_reason = null
watch_state = pending_create
```

然后通过 outbox / repair job 异步创建 Watch。只有 Watch 创建成功后，才进入：

```text
status = connected
form_watches.state = active
```

**Severity：P1**  
**影响：可能出现 UI 状态与实际 Watch 状态不一致。**

---

### 3.3 `forms.status` 与 `form_watches.state` 的状态职责仍然混在一起

文档中 `forms.status` 包含：

```text
connected / paused / needs_reconnect / setup_failed / delivery_issue / deleted
```

同时 `form_watches.state` 包含：

```text
active / suspended / expired / deleting
```

这两个状态机容易出现组合爆炸。例如：

| forms.status | form_watches.state | 是否合理 |
|---|---|---|
| connected | active | 合理 |
| connected | expired | 不合理，但可能发生 |
| paused | active | 不合理，但可能由于删除 Watch 失败发生 |
| setup_failed | active | 不合理 |
| delivery_issue | expired | 需要更细分 |
| needs_reconnect | suspended | 可能合理 |

当前文档没有定义状态一致性约束，也没有说明 Dashboard 应以哪个状态为准。

**建议修正：**

增加一个状态派生规则：

```text
Dashboard status = deriveFormStatus(forms, form_watches, google_credentials, alert_configs)
```

并约束：

1. `forms.status` 表示用户可理解的业务状态。
2. `form_watches.state` 表示 Google Watch 技术状态。
3. repair job 负责修复不一致组合。
4. 所有 Dashboard 展示不得直接只读 `forms.status`。

**Severity：P1**  
**影响：后期 Dashboard、repair、support 排错会混乱。**

---

### 3.4 Worker 的 Slack 重试与幂等策略仍不够闭环

当前文档有 `response_deliveries`、`retryable_error`、`attempt_count`、`available_at`、`lease_until`，但没有完整定义下面几个关键场景：

1. Slack 200 成功，但 DB 写 `sent` 失败。
2. Slack timeout，实际 Slack 可能已收到消息。
3. Slack 返回 429，应该按 Retry-After 还是指数退避。
4. Worker lease 过期后另一个 worker 重试，是否可能重复发送。
5. 同一个 `response_id` 的 delivery 已经 `sent`，worker 是否绝对禁止再次发送。
6. Slack Incoming Webhook 没有天然 idempotency key，重复风险只能在本系统侧控制。

当前方案中的 `unique(form_db_id, response_id)` 是必要条件，但不足以解决 Slack 200 后 DB 写失败的“已发但未记录”问题。

**建议修正：**

必须明确 delivery 状态机，例如：

```text
new → claimed → rendering → sending → sent
                         ↘ retryable_error
                         ↘ permanent_error
```

并明确发送策略：

- 选择 **at-most-once**：只要进入 sending，就尽量不重复发，可能漏发。
- 或选择 **at-least-once**：失败重试，可能重复发。
- 或在 Slack message 中加入内部去重标识，例如 response_id，但这只能帮助人类识别，不能阻止 Slack 接收重复。

对 FormAlert 这类通知工具，建议优先选择：

```text
at-least-once with duplicate-risk disclosure and strong internal sent guard
```

但必须写清楚。

**Severity：P1**  
**影响：Slack 重复通知或漏通知会直接影响用户信任。**

---

### 3.5 Cloud Monitoring 核心依赖仍未验证，不能进入生产开发

文档已经把 Phase 2 写成 Cloud Monitoring PoC，这是正确的。深层评审后仍然认为：

**Cloud Monitoring 不应直接进入生产级代码开发。**

必须先验证：

1. Google Forms watch 创建、续订、删除的真实行为。
2. Watch 到期时间、suspended、expired 的恢复路径。
3. Pub/Sub 是否存在合并通知、重复通知、延迟通知。
4. `responses.list()` 是否足够稳定支撑 120s overlap。
5. 同一 Form 高频提交时，pg-boss singleton 是否会造成处理延迟。
6. 100 Forms × 14 天续订稳定性。
7. 用户 revoke OAuth 后，系统是否能稳定进入 `needs_reconnect`。
8. Form 被删除、权限被移除、题目结构变化后的行为。
9. Google API quota 是否能覆盖 Business 100 Forms 用户。
10. OAuth verification / scope 审核成本。

**Severity：P0 for Phase 3**  
**影响：如果绕过 PoC 直接开发，可能出现架构方向失败。**

---

## 4. 产品与商业规则评审

### 4.1 套餐规则可以进入开发

当前套餐设计可以接受：

| Plan | 评价 |
|---|---|
| Free | 7 天或 30 次试用，合理 |
| Standard | 20 Forms，$5/月，$39/年，合理 |
| Business | 100 Forms，$8/月，$79/年，合理 |
| Conditions | Paid unlimited + hidden cap 50，合理 |
| Refund | 不做常规退款，只保留支付风险防御，合理 |

建议进入开发前再确认一个问题：

```text
Standard 是 10 Forms 还是 20 Forms？
```

你早期参考 SlackNotify 是 10 Forms；当前文档是 20 Forms。20 Forms 可以作为更强差异化，但要确认这是产品决策，不是文档误差。

**Severity：P2**  
**影响：不阻塞技术开发，但影响定价页、Plan limit、数据库默认值。**

---

### 4.2 降级后的自动恢复策略基本合理，但 UI 需要同步设计

文档规定：

```text
用户手动 Resume 只能恢复 pause_reason=user。
pause_reason=downgrade 不能手动 Resume。
重新激活付费授权码后，系统自动恢复 downgrade Forms。
```

这个后端逻辑可以接受，但插件 UI 必须配合：

1. 对 downgrade paused Forms，不应只显示 disabled。
2. 应显示：`Paused after plan downgrade`。
3. 按钮应显示：`Upgrade to resume`，而不是普通 Resume。
4. 重新付费后，应显示哪些 Forms 被自动恢复、哪些因为名额不足仍保持暂停。

否则用户会误以为插件坏了。

**Severity：P1 for UI/API contract**  
**影响：不是后端阻塞，但会影响插件端体验和客服成本。**

---

### 4.3 Free 试用耗尽后的状态需要更明确

当前文档中 `accounts.entitlement_status` 有：

```text
active / expired / exhausted / payment_issue / revoked
```

`free_trials.status` 也有：

```text
active / expired / exhausted
```

但没有明确二者关系。

例如：

| 场景 | accounts.plan | accounts.entitlement_status | free_trials.status |
|---|---|---|---|
| Free 7 天过期 | free | expired | expired |
| Free 30 次耗尽 | free | exhausted | exhausted |
| Standard 到期且 Free 已过期 | free | expired | expired |
| refund revoked 但 Free 仍有效 | free? | revoked? | active? |

需要定义谁是权威。

**建议：**

1. `accounts.plan` 表示购买层级，不表示当前可用性。
2. `free_trials.status` 表示 Free 试用自身状态。
3. `resolveEntitlement()` 是唯一权威。
4. `accounts.entitlement_status` 可以作为缓存或展示字段，但不能作为核心判断依据。

**Severity：P1**  
**影响：Worker、Dashboard、Plan API 可能出现不一致。**

---

## 5. 技术架构深层评审

### 5.1 Web App 与 Control Plane 共用 Neon，需要明确 migration owner

文档中 Web(Vercel) 和 Control Plane(Cloud Run) 共享同一 Neon PostgreSQL。这个方案对独立开发者友好，但需要明确：

1. 谁负责执行 Drizzle migration？
2. Web 和 CP 的 schema 版本如何一致？
3. Vercel 和 Cloud Run 是否共用同一 DATABASE_URL？
4. 是否使用 Neon connection pooling？
5. pg-boss 对 Neon serverless 连接模型是否稳定？

如果没有 migration owner，后期会出现：

```text
Web 先部署新 schema 写入 licenses.code_hash
CP 仍按旧 schema 读取
```

**建议：**

增加：

```text
Schema migration 只能由一个部署流程执行，例如 Web repo 的 migration job 或独立 migration command。
所有服务启动时检查 DB schema version。
```

**Severity：P1**  
**影响：多服务共库下的 schema drift 风险。**

---

### 5.2 pg-boss 与业务表混用需要隔离策略

文档将 pg-boss 作为 queue，并且又定义了 `processing_jobs` 表。这里存在概念重叠：

1. pg-boss 本身有 job table。
2. 文档又定义 `processing_jobs`。
3. 需要明确 `processing_jobs` 是业务可观测表，还是 pg-boss 扩展表，还是完全替代 pg-boss job 表。

当前写法：

```text
processing_jobs（pg-boss 扩展）
```

不够清晰。

**建议：**

二选一：

- 使用 pg-boss 原生表：不自定义 `processing_jobs`，只在 `response_deliveries` 记录业务状态。
- 或自建 `processing_jobs`：不要再称为 pg-boss 扩展，而是自研队列表。

推荐第一种，降低复杂度。

**Severity：P1**  
**影响：队列实现可能重复建模，增加开发难度。**

---

### 5.3 Envelope encryption 的粒度合理，但需要密钥轮换设计

文档中 `google_credentials`、`alert_configs` 都有：

```text
encrypted_xxx
wrapped_dek
```

方向正确，但缺少：

1. DEK 是否 per row、per account、per form。
2. KMS key rotation 后如何 rewrap。
3. 如果 KMS 解密失败，Form 状态如何展示。
4. 是否允许 Support 工具解密。
5. 是否记录 decryption error，但不泄露密文。

**建议：**

增加最小设计：

```text
- credentials: per account DEK
- alert_configs: per form config DEK
- key_version 存储在 wrapped_dek metadata 中
- support 默认无解密能力
- KMS failure → forms.status = setup_failed or delivery_issue + error_code=KMS_DECRYPT_FAILED
```

**Severity：P1**  
**影响：加密实现可行性和后续安全审计。**

---

### 5.4 OAuth account linking 还需要更完整

文档中 Add-on → Control Plane 使用 `ScriptApp.getIdentityToken()`，同时 OAuth callback 存储 refresh token。这里有一个身份绑定问题：

1. Add-on 里的 OIDC `sub`。
2. Google OAuth callback 返回的 user/sub。
3. `accounts.google_subject`。
4. OAuth `state` 参数。
5. Add-on 当前 session。

需要确保 OAuth callback 存入的 refresh token 与正在使用 Add-on 的同一个 Google 用户绑定。

如果 `state` 没有绑定 account/session，可能出现：

```text
用户 A 打开 Add-on
用户 B 完成 OAuth callback
refresh token 绑定错 account
```

**建议：**

OAuth start 返回 URL 时，生成：

```text
state = signed(account_id, nonce, expires_at, csrf)
```

callback 校验 state 后再写入 `google_credentials`。

**Severity：P1**  
**影响：账号串绑是严重安全问题。**

---

### 5.5 Account deletion 需要区分“删除账号”和“取消订阅”

当前 DELETE /v2/account 中包含：

```text
取消 active Creem 订阅
删除或匿名化 orders
删除 licenses
```

这在隐私删除上方向正确，但需要更细：

1. 用户删除账号是否等于取消订阅？
2. 如果 Creem 取消失败，是否继续删除本地数据？
3. 订单数据是否因财务合规必须保留？
4. 删除后 Webhook 再收到 subscription.renewed 怎么处理？
5. 删除后的 license code 是否作废？

**建议：**

增加 tombstone 表或最小记录：

```text
deleted_accounts(account_id, google_subject_hash, deleted_at, creem_subscription_ids, reason)
```

用于处理删除后迟到的 Creem webhook。

**Severity：P1**  
**影响：支付事件与删除请求之间存在异步冲突。**

---

## 6. API 设计评审

### 6.1 `/v2/forms/register` 需要明确幂等语义

文档说明 `unique(account_id, form_id)`，但 API 行为未定义：

1. 重复注册同一个 Form 返回 200 还是 409？
2. 如果之前 deleted，再 register 是恢复还是新建？
3. 如果 pause_reason=payment_risk，是否允许 register？
4. 如果 Form title 改名，register 是否更新 title？
5. 如果当前 plan limit 已满，重复 register 是否仍算超额？

**建议：**

定义：

```text
POST /v2/forms/register is idempotent by (account_id, form_id).
- existing connected/paused → return existing record
- deleted → create new record or restore, must choose one
- title changed → update form_title
```

**Severity：P1**  
**影响：Add-on 多次保存/刷新时可能创建重复逻辑。**

---

### 6.2 `/v2/forms/:formId/test` 需要定义是否受套餐限制

当前只写：

```text
测试最新 response（不计配额）
```

但需要明确：

1. Free 已过期后还能 Test 吗？
2. Payload 是 paid feature，Free 能测试 payload 吗？
3. Webhook 失效时 test 是否写 debug_events？
4. Test 是否允许绕过 pause?
5. Test 是否发送真实 Slack？

建议：

```text
Test sends real Slack.
Test does not consume Free quota.
Test still enforces feature gating: Free cannot test payload/conditions.
Test allowed when form is paused, but UI must show paused warning.
```

**Severity：P1**  
**影响：用户可能用 Test 绕过付费限制或误解暂停状态。**

---

### 6.3 `/api/license/check` 无鉴权接口需要更谨慎

接口：

```text
GET /api/license/check?code=...
```

虽然限速 10 req/min，但它会暴露授权码状态和 plan。授权码熵很高，暴力破解风险低，但仍需注意：

1. 不要返回 buyer_email。
2. 不要返回 activated_account_id。
3. 不要返回 valid_until 的精确值，除非必要。
4. 对不存在和存在但不可用的错误响应应尽量统一，降低枚举信号。

**Severity：P2**  
**影响：不是阻塞，但属于安全细节。**

---

## 7. 安全与合规评审

### 7.1 V2 隐私文案是 GA 阻塞项

V2 方案已经变成：

```text
response 内容会被后端 Worker 通过 Forms API 拉取，并在内存中处理。
```

虽然不落库，但这与早期“不进入服务器”的承诺完全不同。因此必须在以下位置更新：

1. 官网 Privacy Policy。
2. Marketplace Listing。
3. OAuth consent screen。
4. 插件 Help / FAQ。
5. 安装引导页。

必须明确：

```text
We process form responses in memory to evaluate filters and send Slack notifications.
We do not store full response values.
Slack webhook URLs and templates are encrypted at rest.
```

**Severity：P0 for GA，P1 for PoC**  
**影响：不影响 PoC，但影响审核和公开上线。**

---

### 7.2 Debug 日志脱敏策略需要白名单化

当前 debug_events 定义：

```text
status
error_code
actionable_hint
```

并说明不含 response value / Webhook / token / payload。方向正确，但需要工程约束：

1. 只能通过 DebugService 写入。
2. error_code 使用枚举白名单。
3. status/actionable_hint 不允许拼接用户输入。
4. Slack response body 不写入。
5. Google API error message 需要 redaction。

**Severity：P1**  
**影响：防止开发中不小心把 response value 写进日志。**

---

### 7.3 Support 工具默认不应能解密 secrets

方案用了 KMS，但没有明确 Support/Admin 是否可以解密：

1. Slack Webhook。
2. refresh token。
3. payload template。
4. conditions。

建议：

```text
默认没有任何后台 UI 可以直接查看明文 secrets。
必要支持时，只显示 masked webhook，例如 https://hooks.slack.com/services/***/***。
```

**Severity：P1**  
**影响：用户信任和安全审核。**

---

### 7.4 OAuth scopes 是当前最大外部审核风险

文档将 scope 分类确认放在 Phase 0，这是正确的。但深层评审认为它是 **Cloud Monitoring 是否成立的第一阻塞项**。

必须确认：

1. 是否需要读取 Form body。
2. 是否需要读取 Form responses。
3. 是否能只针对用户注册的 Form 操作，而不是 Drive 范围扫描。
4. 这些 scopes 是否触发 sensitive/restricted verification。
5. 若审核成本过高，是否回退到更轻权限方案。

**Severity：P0 for Cloud Monitoring**  
**影响：如果 scope 过重，商业可行性会被审核成本击穿。**

---

## 8. 开发准入门槛

### 8.1 Phase 0 — 允许立即进入

Phase 0 必须做，且可以立刻开始：

- Creem Webhook 联调。
- ScriptApp OIDC 验证。
- Google OAuth offline access 验证。
- Forms API scopes 分类确认。
- Forms watch + Pub/Sub 最小通路验证。
- KMS + Neon 加解密 PoC。
- Privacy Policy 草稿。
- Response 不落库的日志链路验证。

### 8.2 Phase 1 — 条件允许进入

Phase 1 可以进入代码开发，但必须在开发前或开发首日完成以下设计锁定：

- Free quota 发送前预占模型。
- License activation 完整事务。
- OAuth state/account linking。
- `free_trials` bootstrap 同事务或补偿机制。
- `/v2/forms/register` 幂等规则。
- `/v2/forms/:formId/test` 套餐约束。
- debug_events 白名单。
- migration owner。

### 8.3 Phase 2 — 只允许 PoC

Phase 2 不能直接作为生产开发。PoC 必须产出：

1. Watch 创建 / 续订 / 删除报告。
2. Pub/Sub 重复通知与延迟测试。
3. responses.list 分页与 overlap 测试。
4. 100 Forms 14 天稳定性报告。
5. KMS 性能与失败恢复报告。
6. Worker 重试与重复 Slack 发送报告。
7. OAuth revoke / reconnect 报告。
8. API quota 和成本估算。

### 8.4 Phase 3 — 当前不允许进入

完整 Cloud Monitoring MVP 必须等 Phase 2 PoC 通过后再开始。否则容易投入大量开发后发现核心依赖不可控。

---

## 9. 最终准入结论

### 9.1 是否可以进入代码开发？

**可以，但只能分阶段进入。**

允许进入：

```text
Phase 0 前置验证
Phase 1 授权码 / Creem / Free Trial / Account / Plan API
```

不允许直接进入：

```text
完整 Cloud Monitoring Worker
Watch Manager 生产实现
Pub/Sub Ingress 生产实现
100 Forms 生产承诺
Marketplace GA
```

### 9.2 当前最大风险排序

| Rank | Risk | Severity |
|---|---|---|
| 1 | Free quota 发送后扣减导致并发超发 | P0 |
| 2 | Forms API / Watch / OAuth scope 外部可行性未验证 | P0 for Cloud Monitoring |
| 3 | Slack webhook 无 idempotency，重复发送策略未定义 | P1 |
| 4 | OAuth account linking 未完整定义 | P1 |
| 5 | forms.status 与 form_watches.state 可能不一致 | P1 |
| 6 | License 激活中 DB 状态恢复与 Watch 重建外部副作用未完全拆开 | P1 |
| 7 | 多服务共用 Neon 的 migration owner 未定义 | P1 |
| 8 | Debug 日志脱敏缺少工程白名单 | P1 |
| 9 | DELETE account 与 Creem 迟到 Webhook 冲突 | P1 |
| 10 | Test endpoint 付费边界未定义 | P1 |

### 9.3 一句话结论

**这份方案已经可以作为后端开发蓝图，但不能整体无条件开工。先做 Phase 0 与 Phase 1；Cloud Monitoring 必须先 PoC。进入正式 Worker 开发前，必须先修正 Free quota 预占、OAuth 账号绑定、Slack 幂等、Watch 状态一致性和日志脱敏这些深层问题。**
