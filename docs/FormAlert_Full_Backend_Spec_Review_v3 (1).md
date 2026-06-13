# FormAlert Full Backend Spec(3) — 开发准入评审

评审文件：`FormAlert_Full_Backend_Spec(3).md`  
评审版本：Review v3.0  
评审日期：2026-06-11  
评审目标：判断后端方案是否可以进入代码开发阶段。  
评审前提：以 **V2 Cloud Monitoring 全面替换 Apps Script 执行模式** 为产品方向；Apps Script 只作为 Google Forms Add-on UI / OAuth 发起 / 配置入口，不承担 response 监听、Filter 执行、Slack 发送。

---

## 1. 总体结论

**结论：Conditional GO。**

这版方案可以进入 **Phase 0 前置验证** 和 **Phase 1 授权码系统开发**，但不建议直接进入完整 Cloud Monitoring MVP 的生产级开发。

原因：

1. 商业规则已经基本修正：Free 改为 7 天或 30 次一次性试用；Standard / Business 不再限制 Conditions；授权码改为 hash 存储；订阅取消保留到 `valid_until` 后再降级。
2. V2 Cloud Monitoring 主架构方向成立：Control Plane、Pub/Sub、Worker、KMS、Neon、Creem、Resend 的分工清晰。
3. 仍有少量文档字段残留和状态机不一致，会直接影响数据库 schema、API 和授权码实现。
4. Cloud Monitoring 依赖 Google Forms watch、Pub/Sub、ScriptApp OIDC、OAuth scope、KMS + Neon 等外部能力，必须先 PoC，不应直接进入生产开发。

最终建议：

| 阶段 | 结论 | 说明 |
|---|---|---|
| Phase 0 前置验证 | GO | 可以立即开始 |
| Phase 1 授权码系统 | Conditional GO | 修复 P1-01 至 P1-08 后可开发 |
| Phase 2 Cloud Monitoring | PoC Only | 只能做 PoC，不进入生产级 MVP |
| Phase 3 MVP | NO-GO | 等 PoC 和稳定性测试通过后再进入 |

---

## 2. 已通过的关键改进

| ID | 项目 | 结论 |
|---|---|---|
| PASS-01 | Free 从“每月 30 次”改为“7 天或 30 次一次性试用” | 通过 |
| PASS-02 | Standard / Business 不再限制 5/10 Conditions | 通过 |
| PASS-03 | 付费 Conditions 改为 Unlimited，并加隐藏安全上限 50 | 通过 |
| PASS-04 | Free 无需授权码，OAuth bootstrap 后自动激活 | 通过 |
| PASS-05 | 授权码改为 `code_hash` 存储 | 通过 |
| PASS-06 | 订阅取消后保留到 `valid_until`，到期后降级 | 通过 |
| PASS-07 | refund / dispute 改为支付风险事件，而不是常规降级流程 | 通过 |
| PASS-08 | Business 有效期内拒绝 Standard 授权码 | 通过 |
| PASS-09 | 降级暂停的 Forms 在重新付费后自动 Resume | 基本通过 |
| PASS-10 | V2 全面替换 Apps Script 的方向已写入关键决策 | 通过 |

---

## 3. 是否可以进入代码开发阶段

### 3.1 可以立即开发的部分

以下部分可以进入代码开发：

1. Web 端 Creem webhook 接收与签名验证。
2. 授权码生成。
3. 授权码 HMAC hash 存储。
4. Resend 授权码邮件。
5. `orders` / `licenses` / `accounts` / `free_trials` 基础 schema。
6. `/v2/license/activate` 的基础实现。
7. Free trial bootstrap。
8. `/v2/account/plan` 查询接口。
9. Add-on License UI 与后端激活接口联调。
10. Phase 0 技术验证任务。

但进入开发前，必须先修正文档中的 P1 问题，避免 Codex 或开发者按旧字段建表。

### 3.2 暂不建议直接开发的部分

以下部分不建议直接进入生产级开发：

1. Pub/Sub ingress。
2. Response Worker。
3. Watch Manager。
4. 100 Forms 自动续订。
5. response cursor / overlap。
6. Slack retry 状态机。
7. KMS envelope encryption 的完整生产实现。
8. `forms.responses.list()` 的生产级 worker。

这些必须先做 PoC，并在 PoC 通过后再进入 MVP 开发。

---

## 4. Remaining Issues Before Development

| ID | Severity | Area | Issue | Impact | Required Fix |
|---|---|---|---|---|---|
| P1-01 | P1 | Architecture Diagram | 1.1 总体部署图仍保留 `monthly_send_usage` | 与 `free_trials` 模型冲突，会误导 schema 实现 | 全文替换为 `free_trials` |
| P1-02 | P1 | Purchase Flow | 4.1 仍写 `INSERT INTO licenses（code, plan...）` | 与 `code_hash` 设计冲突 | 改为 `INSERT licenses(code_hash, plan...)`；明文 code 只在内存中传给 Resend |
| P1-03 | P1 | Email Template | 4.4 示例使用 `license.code` | DB 不再保存明文 code，实现时会找不到字段 | 改为 `plaintextCode` 或 `generatedPlaintextCode` |
| P1-04 | P1 | License Activation | 5.1 仍写 `SELECT * FROM licenses WHERE code = $1` | 与 `code_hash` 查询冲突 | 改为 `WHERE code_hash = HMAC_SHA256(input_code, LICENSE_PEPPER)` |
| P1-05 | P1 | License Schema | `licenses` 表缺少 `cancel_at_period_end` / `cancelled_at` 字段，但 5.2 使用它 | schema 与流程不一致 | 补充字段 |
| P1-06 | P1 | License Status | `licenses.status` 缺少 `superseded` 状态 | Standard → Business 升级时旧 license 难以表达 | 增加 `superseded`，升级时旧 license 标记为 superseded |
| P1-07 | P1 | Unique Constraint | `UNIQUE (activated_account_id) WHERE status='active'` 与升级流程冲突 | 激活 Business 时可能违反唯一约束 | 在事务中先 lock 当前 active license 并 supersede，再激活新 license |
| P1-08 | P1 | Account Plan API | `/v2/account/plan` 响应仍返回 `monthly_usage` | 与 Free trial 模型冲突 | 改为 `free_trial: { send_used, send_limit, expires_at, status }` |
| P1-09 | P1 | Free Trial Atomicity | Free 发送后递增 `send_used` 的 SQL 未防并发突破 30 次 | 高并发下可能超过 Free 上限 | 使用条件 UPDATE：`send_used < send_limit AND now() <= expires_at RETURNING` |
| P1-10 | P1 | Free Trial Start | 2.3 写“安装后 7 天内”，3.12 写 OAuth bootstrap 创建 | 试用开始时间表达不一致 | 统一为：首次成功 OAuth bootstrap 后开始 |
| P1-11 | P1 | Downgrade Job | valid_until 到期后的 Scheduler 降级 job 缺少幂等键 | 可能重复 Pause / 重复发邮件 | 增加 downgrade job idempotency key，例如 `account_id + license_id + valid_until` |
| P1-12 | P1 | Payment Risk | refund/dispute 描述为“超额 Forms 系统 Pause” | 支付风险不应只处理超额 Forms | 支付风险应 revoke entitlement，并按 current effective entitlement 重新处理所有 Forms |
| P1-13 | P1 | Resume Rule | API `/resume` 仍写 downgrade/payment_risk 都返回 403，但 5.2 又说付费后系统自动 Resume | 规则基本合理，但文案容易误解为永远不能恢复 | 明确：用户手动 Resume 不允许；付费激活事务内系统可自动 Resume downgrade Forms |
| P1-14 | P1 | V1 Conflict | 10.4 仍写“Free 用户 V1 Add-on 继续运行，互不影响” | 与 V2 全面替换 Apps Script 决策冲突 | 删除 V1 Add-on 继续运行表述 |
| P1-15 | P1 | Pricing | 年费 $50/$80 与此前竞品参考 $39/$79 不一致 | 不阻塞开发，但影响商业测试 | 标记为 TBD 或确认最终价格 |
| P1-16 | P1 | External Dependency | Creem event 名称、签名 Header、subscription 字段未验证 | 事件名错误会导致支付闭环失败 | Phase 0 必须实测 |
| P1-17 | P1 | OIDC Dependency | `ScriptApp.getIdentityToken()` 可用性未验证 | 如果不可用，Add-on → CP 鉴权要换方案 | Phase 0 必须实测 |
| P2-01 | P2 | Debug Events | `debug_events` 缺少 error_code 白名单 | 可能误写敏感信息 | 建立只允许脱敏字段的日志写入 API |
| P2-02 | P2 | Account Deletion | `DELETE /v2/account` 未展开删除顺序 | 数据删除实现不明确 | 补充 token、watch、webhook、template、jobs、debug 删除顺序 |
| P2-03 | P2 | Notification Email | buyer_email 与 account email 仍割裂 | 续费、取消、支付风险通知可能发错人 | 激活后保存 notification_email 或同时通知 buyer_email + account email |

---

## 5. Product Review

### 5.1 套餐策略可以进入开发

当前套餐策略基本成立：

```text
Free: 1 Form, 7 天或 30 次试用，无需授权码。
Standard: 20 Forms, $5/月，过滤器、Markdown、Payload。
Business: 100 Forms, $8/月。
```

Conditions 不再作为套餐差异点，这个判断正确。

建议对外文案：

```text
Unlimited filters
```

不要把 `MAX_CONDITIONS_PER_FORM = 50` 展示给用户。它只是后端安全上限。

### 5.2 Free Trial 规则需要统一表达

文档中同时出现：

```text
安装后 7 天内
OAuth bootstrap 完成时自动创建
```

建议统一：

```text
Free trial starts when the user first completes OAuth/account bootstrap.
```

原因：用户可能安装插件但从未打开或授权，如果从 Marketplace 安装日开始计算，会降低试用体验。

### 5.3 降级后自动恢复方案可以接受

当前方案改为：

```text
降级时系统 Pause 超额 Forms。
重新付费后系统按 created_at ASC 自动恢复 downgrade Forms。
```

这个比“Delete 后重新 Register”合理，可以保留。

但要明确：

1. `payment_risk` 暂停不能自动恢复。
2. `downgrade` 暂停可以在重新付费后自动恢复。
3. 用户手动 Resume 仅允许 `pause_reason=user`。
4. 系统自动 Resume 仅发生在成功激活付费套餐后。

---

## 6. Technical Review

### 6.1 授权码模块接近可开发，但还需修字段

授权码设计方向正确：

1. `crypto.randomInt()` 生成。
2. HMAC hash 入库。
3. 明文只在邮件中出现。
4. 激活绑定 Google subject。

但文档中还有旧字段残留。进入代码开发前必须保证：

```text
所有 DB 查询只使用 code_hash。
所有邮件发送使用 plaintextCode。
licenses 表不保存 code 明文。
```

### 6.2 升级流程需要明确事务

推荐事务流程：

```text
BEGIN
1. Lock account row.
2. Hash input code and lock target license row.
3. Lock current active license, if any.
4. resolve current entitlement.
5. If current active Business and input Standard → reject.
6. If upgrade/same-tier renewal allowed:
   - mark old active license as superseded
   - activate new license
   - update accounts.plan / plan_expires_at / entitlement_status
   - autoResumeDowngradePausedForms()
7. COMMIT
```

否则 Standard → Business 可能与 active license 唯一约束冲突。

### 6.3 Free Trial 扣减必须使用条件更新

不要先查再加：

```text
SELECT send_used
UPDATE send_used = send_used + 1
```

推荐：

```sql
UPDATE free_trials
SET send_used = send_used + 1,
    updated_at = now()
WHERE account_id = $1
  AND status = 'active'
  AND send_used < send_limit
  AND now() <= expires_at
RETURNING send_used, send_limit;
```

如果无返回行，则不发送 Slack，写入 `skipped_free_quota` 或 `skipped_free_expired`。

### 6.4 Cloud Monitoring 仍只能进入 PoC

文档本身已经把 Cloud Monitoring PoC 放在 Phase 2，这是合理的。

正式代码开发前必须验证：

1. `forms.body.readonly` 是否会触发更高审核风险。
2. Google Forms watch 是否能稳定创建、续订、恢复。
3. Pub/Sub push OIDC 校验。
4. `responses.list()` 分页、overlap、幂等。
5. Neon + pg-boss 对 queue 和 worker lease 的支撑能力。
6. Cloud KMS 与 Cloud Run worker 的解密延迟和权限。
7. 100 Forms 14 天 watch 续订测试。
8. Slack 429 / 5xx / timeout 的重试策略。

---

## 7. Security / Compliance Review

### 7.1 可以接受的安全设计

以下安全设计可以保留：

1. refresh token 加密。
2. webhook / template / conditions 加密。
3. 授权码 HMAC hash。
4. 不保存 response 内容。
5. 不记录 webhook / token / full payload。
6. 不申请 Drive / Gmail 权限。
7. Pub/Sub push OIDC。
8. Cloud IAM 调用 internal endpoints。

### 7.2 仍需补充的合规要求

| Area | Required Fix |
|---|---|
| Privacy | 需要单独输出 V2 Privacy / Marketplace disclosure 文案 |
| OAuth | Phase 0 必须确认 Forms scopes 分类与审核要求 |
| Logs | 建立 debug_events 字段白名单，避免误写 response value |
| Deletion | 补充 account deletion runbook |
| Support | 明确 support 默认不能解密 webhook、refresh token、payload |
| Payment | refund/dispute 的用户通知与账号状态文案需要补充 |

---

## 8. Development Gate

### Gate A — 进入 Phase 0

**结论：通过。**

立即执行：

- [ ] Creem webhook 联调。
- [ ] ScriptApp OIDC 验证。
- [ ] OAuth offline access 验证。
- [ ] Forms scope 分类确认。
- [ ] KMS + Neon 加解密 PoC。
- [ ] Privacy Policy 草稿。

### Gate B — 进入 Phase 1 授权码系统开发

**结论：修完 P1-01 至 P1-10 后通过。**

必须完成：

- [ ] 全文清理 `monthly_send_usage`。
- [ ] 全文清理 `license.code` / `WHERE code = $1`。
- [ ] 补充 `cancel_at_period_end` / `cancelled_at` / `superseded`。
- [ ] 修正 `/v2/account/plan` 响应。
- [ ] 明确 Free trial bootstrap 事务。
- [ ] 明确 License activation 事务。
- [ ] 明确 Free send_used 条件更新。
- [ ] 删除 V1 Add-on 继续运行表述。

### Gate C — 进入 Phase 2 Cloud Monitoring PoC

**结论：可以进入 PoC。**

PoC 不是生产开发，必须输出 PoC 报告后才能进入 MVP。

### Gate D — 进入 Phase 3 Cloud Monitoring MVP

**结论：暂不通过。**

必须等：

- [ ] Phase 0 验证完成。
- [ ] Phase 2 PoC 完成。
- [ ] 100 Forms 14 天续订测试完成。
- [ ] OAuth verification 风险确认。
- [ ] 隐私文案确认。
- [ ] Worker 幂等和 Slack 重复发送风险实测完成。

---

## 9. Suggested Codex Fix Prompt

```text
请根据 Review v3.0 修正 FormAlert_Full_Backend_Spec(3).md。不要改变 Cloud Monitoring 主架构，只修正文档中仍然存在的字段残留、状态机冲突和进入开发前阻塞项。

必须修正：

1. 1.1 架构图中的 monthly_send_usage 改为 free_trials。
2. /v2/account/plan 响应中的 monthly_usage 改为 free_trial: { send_used, send_limit, expires_at, status }。
3. 4.1 购买时序中的 INSERT licenses(code...) 改为 INSERT licenses(code_hash...)。
4. 4.4 Resend 邮件模板中的 license.code 改为 plaintextCode，明确明文授权码只存在于生成函数内存和邮件中，不落 DB。
5. 5.1 授权码激活流程中的 SELECT * FROM licenses WHERE code = $1 改为 WHERE code_hash = HMAC_SHA256(input_code, LICENSE_PEPPER)。
6. licenses 表补充 cancel_at_period_end、cancelled_at；并增加 superseded 状态，用于升级时标记旧 license。
7. 修正 license activation 事务：lock account、lock target license、lock current active license；低级覆盖高级拒绝；升级时先 supersede 旧 license，再激活新 license。
8. Free trial 的 send_used 递增必须使用条件 UPDATE，防止并发突破 30 条。
9. 统一 Free trial 开始时间：首次成功 OAuth/account bootstrap 时开始，不是 Marketplace 安装时开始。
10. 补充 valid_until 到期后 scheduler downgrade job 的幂等策略。
11. payment_risk 事件不应只处理“超额 Forms”，应 revoke paid entitlement 并按 effective entitlement 重新处理 Forms。
12. 删除 10.4 中“Free 用户 V1 Add-on 继续运行”这类与 V2 全面替换 Apps Script 冲突的表述。
13. 补充 DELETE /v2/account 的数据删除范围和顺序。
14. 标记 Phase 2 Cloud Monitoring 只能先进入 PoC，不得直接进入生产级 MVP 开发。
```

---

## 10. Final Recommendation

这版方案已经可以作为开发蓝图，但不能无条件进入所有模块的代码开发。

最终建议：

```text
1. 立即进入 Phase 0。
2. 修完 P1 文档问题后，进入 Phase 1 授权码系统开发。
3. Cloud Monitoring 只进入 PoC。
4. PoC 与稳定性测试通过后，再进入完整 Worker / Watch / Pub/Sub 生产开发。
```

一句话：

**授权码与套餐系统可以准备开发；Cloud Monitoring 还必须先 PoC。当前文档仍需一次字段一致性修正，修完后才能放心交给 Codex 写 schema 和 API。**
