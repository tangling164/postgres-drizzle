# FormAlert Full Backend Spec — Review Issues

文件版本：Review v1.0  
评审对象：`FormAlert_Full_Backend_Spec.md`  
评审日期：2026-06-11  
评审立场：以 **V2 Cloud Monitoring 全面替换 Apps Script 执行模式** 为前提进行评审。  
输出方式：仅输出评审意见，不修改原方案文档。

---

## 1. Overall Verdict

这份完整后端方案已经具备较高工程完整度，覆盖了 Web 端购买、授权码发放、插件端激活、Cloud Monitoring、Watch、Worker、加密、队列、数据模型和套餐门控。

但当前文档在**套餐策略、Free 版本生命周期、授权码状态机、取消/退款处理、Conditions 限制、降级规则**上存在明显冲突。尤其是当前文档将 Free 设计成“每月 30 次通知”，并支持 `refund.created` 自动降级，同时给 Standard / Business 设置每 Form Conditions 数量限制，这些都与最新产品判断不一致。

结论：

- 可以进入技术评审和 PoC 拆解。
- 不建议直接进入开发。
- 必须先修正本文档中的 P0/P1 产品规则冲突，否则后端实现会把错误商业规则固化进数据库、Webhook、Worker 和 Add-on UI。

---

## 2. User Suggestions Review

### 2.1 Conditions 不应作为 Standard / Business 的套餐限制

**结论：采纳。**

当前文档将每 Form 最大 Conditions 设置为：

| Plan | Conditions |
|---|---:|
| Free | 0 |
| Standard | 5 |
| Business | 10 |

这不建议保留为商业限制。

理由：

1. Standard 和 Business 已经通过 Forms 数量区分价值。
2. Conditions 数量不是用户直观感知的高价值付费点。
3. 过早限制 Conditions 会制造不必要的客服问题。
4. 产品卖点应聚焦“可监控多少 Forms”，而不是“每个 Form 能写多少条件”。
5. Filter 是 FormAlert 的核心价值，付费版不应在核心能力上过早卡用户。

建议改为：

| Plan | Conditions per Form |
|---|---:|
| Free | 0 |
| Standard | Unlimited* |
| Business | Unlimited* |

`Unlimited*` 不是技术无限。建议后端保留一个统一的安全上限，例如：

```text
MAX_CONDITIONS_PER_FORM = 50
```

该上限仅用于防滥用、请求体大小控制和系统稳定性，不作为套餐营销点展示。

需要修改的文档位置：

- `2.1 套餐功能矩阵`
- `2.2 套餐规则执行位置`
- `7.3 配置保存时的套餐功能校验`
- `6.1 端到端数据流`
- `6.3 Worker 套餐门控伪代码`
- 所有出现 “最多 5/10 条” 的位置

---

### 2.2 Free 版本应为默认激活，不需要授权码

**结论：采纳。**

当前文档中 Free 是一个 plan，但没有完整说明用户在 Google Workspace Marketplace 安装插件后如何自然进入 Free。应明确：

```text
用户从 Google Workspace Marketplace 安装插件
→ 打开 FormAlert Add-on
→ 完成 Google OAuth / account bootstrap
→ 后端自动创建 account
→ 默认 plan = free
→ 无需激活码
```

Free 不应出现在授权码激活流程中。授权码只用于 Standard / Business。

需要新增字段：

```text
accounts.free_started_at
accounts.free_expires_at
accounts.free_send_limit = 30
accounts.free_send_used
accounts.free_status = active / exhausted / expired
```

或者单独建表：

```text
free_trials
```

---

### 2.3 Free 不应是“每月 30 次”，而是“7 天或 30 条消息后不可用”

**结论：采纳，且是 P0 修正项。**

当前文档使用 `monthly_send_usage`，并描述 Free 为“每月 30 次”。这与最新产品判断冲突。

最新规则应为：

```text
Free 默认可用。
Free 不需要授权码。
Free 试用最多 7 天。
Free 试用最多发送 30 条 Slack 消息。
7 天到期或 30 条消息用完，Free 不再可用。
Free 不按月重置。
```

Worker 门控应改为：

```text
if account.plan == "free":
    if now() > free_expires_at:
        skip = true
        reason = "free_trial_expired"

    if free_send_used >= 30:
        skip = true
        reason = "free_quota_exhausted"
```

需要替换：

- `monthly_send_usage`
- `月通知 ≤ 30`
- `本月已成功发送次数`
- `YYYY-MM`
- `Standard / Business Worker 跳过此表检查`

建议改为：

```text
free_trial_usage
```

或将字段直接放入 `accounts`。

---

### 2.4 降级只支持订阅取消，不支持退款流程

**结论：部分采纳，需要澄清。**

产品层面可以明确：

```text
用户主动降级路径只支持 subscription.cancelled。
不提供“退款即降级”的常规产品流程。
```

但工程上仍然必须防御以下事件：

```text
refund.created
chargeback
dispute
payment reversed
fraud review
```

否则一旦支付被撤销但 license 仍然 active，会产生收入风险。

建议：

1. 文档中删除“5 天退款保证”作为公开承诺，除非你决定真的保留退款政策。
2. 正常降级流程只由 `subscription.cancelled` 触发。
3. `refund.created` / `disputed` 不作为普通降级流程描述，但必须作为异常支付事件处理：
   - revoke license
   - mark order refunded / disputed
   - pause paid-only Forms
   - notify user
4. 如果明确“不支持退款”，则删除：
   - Plan 表中的 `5 天退款保证`
   - Resend 邮件中的 `5 天退款保证`
   - Webhook 矩阵中的退款作为常规降级路径
   - 降级章节标题中的“退款”

---

### 2.5 只存在 Standard → Free 和 Business → Free，不支持 Business → Standard 降级

**结论：采纳。**

当前文档包含：

```text
Business → Standard（换购）
```

建议删除。

最新规则应为：

```text
Standard subscription cancelled → Free
Business subscription cancelled → Free
```

不支持：

```text
Business → Standard 自动降级
Standard → Business → Standard 降级
```

升级规则建议：

```text
Standard active → Business license 可激活，视为升级。
Business active 且未过期 → Standard license 不可激活。
Free → Standard / Business 可激活。
```

需要在 `/v2/license/activate` 中增加 plan priority 校验：

```text
business > standard > free
```

若当前账号已有未过期 Business：

```text
输入 Standard license → reject: lower_tier_license_not_allowed
```

---

### 2.6 Business 未过期时 Standard 不可再激活

**结论：采纳。**

当前文档只通过 partial unique index 限制一个账号同一时间只有一个 active license，但没有定义“高套餐未过期时低套餐不可激活”的业务规则。

需要补充激活规则：

| 当前账号状态 | 输入授权码 | 结果 |
|---|---|---|
| Free | Standard | 允许 |
| Free | Business | 允许 |
| Standard active | Business | 允许升级 |
| Standard active | Standard | 可视为续期或拒绝，需产品确认 |
| Business active | Standard | 拒绝 |
| Business active | Business | 可视为续期或拒绝，需产品确认 |

建议先采用最简单规则：

```text
同级续期允许。
低级覆盖高级不允许。
高级覆盖低级允许。
```

---

## 3. Critical Issues

| ID | Severity | Area | Issue | Impact | Required Fix |
|---|---|---|---|---|---|
| P0-01 | P0 | Pricing | Paid plans 限制 Conditions 为 5/10，与最新产品判断冲突 | 会把核心过滤能力做成错误付费墙 | Standard / Business 移除套餐级 Conditions 限制，仅保留统一安全上限 |
| P0-02 | P0 | Free Plan | 当前文档将 Free 设计为每月 30 次 | 与“7 天或 30 条后不可用”冲突 | 移除 monthly_send_usage，改为一次性 Free trial usage |
| P0-03 | P0 | License | Free 默认激活流程缺失 | Marketplace 安装后用户无法自然进入 Free 状态 | OAuth/account bootstrap 后自动创建 Free account，无需授权码 |
| P0-04 | P0 | Downgrade | 文档同时支持 subscription.cancelled 和 refund.created 降级 | 与“不支持退款降级流程”冲突 | 降级章节改为 subscription.cancelled；refund/dispute 作为异常支付事件单独处理 |
| P0-05 | P0 | Plan State | Business active 时 Standard license 不可激活未定义 | 可能导致高级套餐被低级套餐覆盖 | 激活接口增加 plan priority 校验 |
| P0-06 | P0 | Product Copy | 文档仍包含 5 天退款保证 | 与“不支持退款”冲突 | 删除退款保证，或重新确认是否保留退款政策 |
| P1-01 | P1 | Downgrade Timing | subscription.cancelled 后是立即降级还是到期降级未定义 | 可能损害用户已付款权益 | 按 valid_until 到期后降级，除非支付异常 |
| P1-02 | P1 | Data Model | `monthly_send_usage` 与新 Free trial 模型不匹配 | 数据表设计错误 | 改为 `free_trial_usage` 或 accounts trial fields |
| P1-03 | P1 | Worker | Free Worker 逻辑按月检查配额 | 会错误重置 Free 额度 | 改为 lifetime trial checks |
| P1-04 | P1 | API | `PUT /config` 按 5/10 Conditions 校验 | 会错误拒绝付费用户配置 | 删除 plan-based limit；保留 request size 和统一 max cap |
| P1-05 | P1 | License Code | 授权码明文存储风险偏高 | DB 泄露时可直接盗用未激活 license | 建议存 HMAC hash，邮件中只展示明文 |
| P1-06 | P1 | License Generation | 示例算法声称 120 bits，但实现方式容易被误写 | 可能出现熵判断错误 | 使用逐字符 secure randomInt 或明确 base32 encoding |
| P1-07 | P1 | Refund/Dispute | 即使不支持退款，也未定义支付撤销防御 | 支付撤销后可能继续享受服务 | 保留异常支付事件 revoke 逻辑，但不要作为用户降级流程 |
| P1-08 | P1 | Plan Matrix | Standard 年费 $50、Business 年费 $80 与此前 SlackNotify 参考价格不一致 | 价格策略变化可能影响转化 | 产品确认最终价格，避免文档间冲突 |
| P1-09 | P1 | OAuth/Add-on | `ScriptApp.getIdentityToken()` 可用性仍需验证 | 若不可用会阻塞 Add-on → CP 鉴权 | Phase 0 必须保留验证任务 |
| P2-01 | P2 | UI | Add-on License UI 中仍显示“输入新授权码续期” | 续期/升级/降级规则不清晰 | 改为 Upgrade / Renew / Manage billing 三类动作 |
| P2-02 | P2 | Webhook | Creem IP 白名单可能维护成本高 | IP 变动可能导致误拒 | 以签名校验为主，IP 白名单作为可选增强 |
| P2-03 | P2 | Support | buyer_email 与 account email 不关联，降级通知收件人可能不准确 | 用户可能收不到账户状态通知 | 激活后可保存 account notification email 或同时通知 buyer_email/account email |

---

## 4. Product Issues

### 4.1 Conditions 不应是定价维度

Conditions 数量不是好的套餐区分点。Form 数量已经足够区分 Standard / Business：

```text
Free: 1 Form
Standard: 20 Forms
Business: 100 Forms
```

建议付费版统一：

```text
Filter conditions: Unlimited
```

但后端设置隐藏安全上限：

```text
MAX_CONDITIONS_PER_FORM = 50
REQUEST_BODY_LIMIT = 64 KB
```

### 4.2 Free Trial 需要独立生命周期

Free 不是永久免费月度额度，而是试用。

推荐产品定义：

```text
Free trial:
- Starts when user first connects FormAlert account.
- Ends after 7 days or 30 successful Slack sends, whichever comes first.
- No license code required.
- After expiry/exhaustion, monitoring is disabled until upgrade.
```

### 4.3 取消订阅不等于立即降级

订阅取消通常有两种语义：

1. 立即取消。
2. 当前周期结束后取消。

文档必须明确按哪种执行。推荐：

```text
用户取消订阅后，paid plan 保持到 valid_until。
valid_until 到期后降级到 Free eligibility check。
如果 Free 已过期或额度已用完，则 account 状态变为 free_expired。
```

### 4.4 降级到 Free 后未必能继续使用 Free

你提出的规则是正确的：

```text
如果用户降级到 Free 时，Free 7 天已过或 30 条已用完，Free 也不可用。
```

因此降级逻辑不是简单：

```text
accounts.plan = free
```

而应是：

```text
if free trial still available:
    plan = free
else:
    plan = free_expired / inactive
```

建议新增 account effective state：

```text
plan = free / standard / business
entitlement_status = active / expired / exhausted / cancelled / payment_issue
```

或者：

```text
effective_plan = none / free / standard / business
```

---

## 5. Technical / Architecture Issues

### 5.1 数据模型需要替换 monthly_send_usage

当前 `monthly_send_usage` 只适合“Free 每月 30 条”，不适合“7 天或 30 条一次性试用”。

建议替换为：

```sql
free_trials (
  account_id uuid unique,
  started_at timestamptz,
  expires_at timestamptz,
  send_limit int default 30,
  send_used int default 0,
  status text -- active / expired / exhausted
)
```

或合并到 `accounts`：

```text
free_started_at
free_expires_at
free_send_limit
free_send_used
free_status
```

### 5.2 Worker 门控应按 effective entitlement 判断

当前 Worker 只读取：

```text
accounts.plan
```

建议改为：

```text
entitlement = resolveEntitlement(account)
```

输出：

```json
{
  "effectivePlan": "none | free | standard | business",
  "reason": "free_active | free_expired | free_exhausted | paid_active | paid_expired"
}
```

Worker 根据 `effectivePlan` 决定是否发送。

### 5.3 License activation 需要 plan priority lock

`UNIQUE (activated_account_id) WHERE status = 'active'` 不足以处理升级/续期/低级覆盖高级。

建议在事务中执行：

```text
SELECT current active license/account entitlement FOR UPDATE
compare plan_rank
if new_rank < current_rank and current not expired:
    reject lower_tier_license_not_allowed
if new_rank >= current_rank:
    activate/upgrade according to policy
```

### 5.4 Refund/Dispute 应从“产品流程”变成“异常支付处理”

即使不支持退款，后端也不能忽略 Creem 的 refund/dispute/chargeback 类事件。建议文档拆分为：

1. Subscription lifecycle:
   - order.paid
   - subscription.renewed
   - subscription.cancelled
2. Payment risk events:
   - refund.created
   - dispute.created
   - chargeback
   - payment reversed

用户正常降级只走 cancellation；支付风险事件走 revoke。

### 5.5 授权码建议不要明文存储

文档认为授权码不是密码，因此无需 hash。这个判断可以工作，但从风险控制看不够强。

建议：

```text
license_code_plaintext 只在生成时展示 / 邮件发送
DB 保存 code_hash = HMAC_SHA256(code, LICENSE_PEPPER)
激活时按 hash 查询
```

这样即使数据库泄露，未激活授权码也不容易被直接盗用。

### 5.6 授权码生成算法建议重写为更简单可靠

当前伪代码较难保证开发者正确实现。

建议：

```typescript
function generateSegment(length = 5) {
  return Array.from({ length }, () => CHARSET[crypto.randomInt(0, CHARSET.length)]).join('');
}

function generateLicenseCode(plan) {
  const prefix = plan === 'business' ? 'FA-B' : 'FA-S';
  return `${prefix}-${seg()}-${seg()}-${seg()}-${seg()}`;
}
```

---

## 6. Required Document Changes

### 6.1 Pricing Matrix

将：

```text
每 Form 最大 Conditions | 0 | 5 | 10
每月 Slack 通知 | 30 次
5 天退款保证
```

改为：

```text
每 Form 最大 Conditions | 0 | Unlimited* | Unlimited*
Free Slack 通知 | 30 total during trial
Free 有效期 | 7 days or 30 sends
退款保证 | 删除，除非产品重新确认保留
```

### 6.2 套餐规则执行位置

删除：

```text
Conditions 数量 ≤ 5/10
```

新增：

```text
Paid conditions no plan-based limit
Server-side safety cap and request size limit
```

### 6.3 Free Worker 行为

删除“月配额检查”。

改为：

```text
Free trial check:
- if free expired → skipped_free_expired
- if free_send_used >= 30 → skipped_free_quota
- otherwise send and increment free_send_used
```

### 6.4 Creem Webhook 事件处理矩阵

将 `refund.created` 从常规降级中移除，改为“payment risk event”。

将 `subscription.cancelled` 明确为：

```text
set cancel_at_period_end / valid_until
do not downgrade until valid_until unless immediate cancel
```

### 6.5 License UI

Free 状态不显示授权码输入为主路径。建议：

```text
Free:
- Trial active / expired / exhausted
- Upgrade buttons
- Optional: Activate paid license

Standard / Business:
- Plan active until date
- Manage billing
- Activate higher-tier or renewal code
```

---

## 7. Suggested Revised Rules

### 7.1 Final Plan Matrix

| Feature | Free | Standard | Business |
|---|---:|---:|---:|
| Price | $0 | $5/mo | $8/mo |
| Enabled Forms | 1 | 20 | 100 |
| Slack sends | 30 total | Unlimited | Unlimited |
| Free duration | 7 days | — | — |
| Message mode | Plain text | Markdown | Markdown |
| Custom Payload | No | Yes | Yes |
| Filters | No | Yes | Yes |
| Conditions per Form | 0 | Unlimited* | Unlimited* |
| Cloud Monitoring | Yes | Yes | Yes |
| License code required | No | Yes | Yes |

`Unlimited*`: subject to fair use, request size limits, and hidden abuse prevention cap.

### 7.2 Downgrade / Cancellation Rules

```text
Standard cancelled:
    plan remains Standard until valid_until
    after valid_until:
        if Free trial still available → Free
        else → No active entitlement / upgrade required

Business cancelled:
    plan remains Business until valid_until
    after valid_until:
        if Free trial still available → Free
        else → No active entitlement / upgrade required

Refund/dispute/payment reversal:
    revoke paid entitlement according to payment-risk policy
    not presented as normal downgrade flow
```

### 7.3 License Activation Rules

```text
Free:
    default account state after Marketplace install/OAuth.
    no license code required.

Standard code:
    allowed if current effective plan is none/free/standard.
    rejected if current effective plan is active Business.

Business code:
    allowed if current effective plan is none/free/standard/business.
    if Standard active, upgrades to Business.

No automatic Business → Standard downgrade.
No refund-based downgrade flow.
```

---

## 8. Suggested Codex Fix Prompt

```text
请根据 Review v1.0 修改 FormAlert_Full_Backend_Spec.md，但不要改动 Cloud Monitoring 主架构。

必须修改：

1. 移除 Standard / Business 的 Conditions 套餐限制。Paid plans 不再按 5/10 限制 Conditions；只保留一个统一后端安全上限，例如 MAX_CONDITIONS_PER_FORM=50，不作为套餐卖点展示。
2. 删除所有 “每 Form 最大 Conditions | 0 | 5 | 10” 和 “conditions.length > 5/10” 的套餐校验。
3. 将 Free 从“每月 30 条”改为“一次性试用：7 天或 30 条 Slack 发送，任一达到后 Free 不再可用”。
4. 移除 monthly_send_usage 设计，改成 free_trials 或 accounts 中的 free_started_at/free_expires_at/free_send_used/free_status。
5. 明确用户从 Google Workspace Marketplace 安装并完成 OAuth 后默认进入 Free，无需激活码。
6. 授权码只用于 Standard / Business。
7. 订阅降级只支持 subscription.cancelled：Standard→Free eligibility check，Business→Free eligibility check；不支持 Business→Standard 自动降级。
8. Business active 且未过期时，Standard 授权码不可激活。
9. Standard active 时，Business 授权码可以作为升级激活。
10. 删除“5 天退款保证”，除非产品重新确认保留退款政策。
11. refund.created / dispute / chargeback 不作为正常降级流程，只作为异常支付风险事件处理。
12. subscription.cancelled 后是否立即降级或到 valid_until 后降级必须明确；推荐到 valid_until 后再降级。
13. Worker 门控改为 resolveEntitlement(account)，不能只看 accounts.plan。
14. License activation 增加 plan priority 校验。
15. 建议授权码在 DB 中保存 HMAC hash，而不是明文 code。
16. 更新 Plan Matrix、Worker 伪代码、Webhook 事件矩阵、数据模型、License UI 状态机、验收标准。
```

---

## 9. Final Recommendation

这份方案的技术主架构可以保留，尤其是：

- Cloud Run Control Plane
- Pub/Sub Ingress
- pg-boss / worker
- Neon PostgreSQL
- KMS 加密
- Forms watch
- Dashboard 读取后台已注册 Forms
- 不扫描 Drive / 不使用 Gmail

但商业规则必须先修正。当前最危险的问题不是 Cloud Monitoring 架构，而是：

1. Free 被错误设计成月度免费额度。
2. Conditions 被错误设计成付费层级限制。
3. 退款、取消、降级、Business 覆盖 Standard 的规则不一致。
4. Free 默认激活和 Free 过期后的不可用状态没有被建模。

建议在修正上述 P0/P1 后，再让 Codex 进入数据库 schema 和 API 实现。
