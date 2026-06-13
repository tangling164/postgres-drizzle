# 产品需求文档（PRD）：FormAlert for Slack

版本：v1.0  
日期：2026-06-08  
产品形态：Google Workspace Add-on + Web 定价/支付/文档站  
核心竞品参考：SlackNotify.app  
当前决策：不做 AI 规则生成器，不做 Web 登录，不做自建 Slack 模板库；采用字段过滤规则 + Slack 官方 Block Kit Payload + 授权码付费升级。

---

## 1. 一句话结论

FormAlert for Slack 是一个面向 Google Forms / Google Sheets 的 Slack 条件通知插件。它在 SlackNotify 的基础上增加“字段过滤规则”：只有当表单提交满足指定字段条件时，才发送 Slack 通知。

核心卖点：

> Send Google Forms responses to Slack — only when they match your rules.

中文理解：

> 给 Google Forms 的 Slack 通知增加过滤规则，只把符合条件的重要提交推送到 Slack。

---

## 2. 产品背景

SlackNotify 已经证明了 Google Forms → Slack 通知这个需求存在。它的产品结构非常清晰：

1. Web 端负责 SEO、安装说明、定价、付费、帮助文档。
2. 插件端负责核心功能：Google Forms 提交后发送 Slack 通知。
3. 付费页支持 Monthly billing 与 Yearly billing。
4. 插件支持普通 Markdown Message 与 Custom Payload Messages。
5. 付费邮箱和插件账号大概率不强绑定，用户通过授权码或类似机制在插件端升级。

FormAlert 不应该重做一个更复杂的 SlackNotify，而是在它最核心的链路前增加一个过滤层：

```text
Google Form 提交
→ 判断字段规则
→ 符合条件才渲染 Message / Payload
→ 发送 Slack Webhook
→ 记录 sent / skipped / error
```

---

## 3. 产品定位

### 3.1 产品名称

FormAlert for Slack

### 3.2 英文定位

Filtered Slack notifications for Google Forms.

### 3.3 首页主标题建议

Send Google Forms responses to Slack — only when they matter.

### 3.4 首页副标题建议

Add smart filters to your Google Forms Slack notifications. Send alerts only when fields match rules like `Budget > 100`, `Priority = High`, or `Message contains refund`.

### 3.5 中文定位

面向 Google Forms 的 Slack 过滤通知工具。用户可以设置字段规则，例如预算大于 100、优先级等于 High、留言包含 refund，只有匹配规则的表单提交才会推送到 Slack。

---

## 4. 目标用户

### 4.1 第一目标用户

1. 小型 SaaS 团队
2. Agency / 外包服务商
3. 独立开发者
4. 客服 / 运营 / 销售团队
5. 使用 Google Forms 收集线索、反馈、Bug、申请、报名的小团队

### 4.2 典型使用场景

| 场景 | 表单用途 | 需要过滤的原因 |
|---|---|---|
| 销售线索 | 客户咨询、项目需求、预算 | 只通知高预算线索 |
| 客服反馈 | 投诉、退款、问题反馈 | 只通知高优先级问题 |
| Bug 报告 | 用户提交 Bug | 只通知严重程度高的 Bug |
| 招聘/申请 | 候选人申请、合作申请 | 只通知符合条件的申请 |
| 社区/课程 | 报名、申请、反馈 | 只通知需要人工处理的提交 |

### 4.3 非目标用户

第一版不服务：

1. 需要 Zapier / Make 级别复杂多步骤自动化的用户。
2. 需要 CRM 双向同步的销售团队。
3. 需要 Slack OAuth / Slack Bot 深度交互的用户。
4. 需要 AI 分析表单内容的用户。
5. 需要 Web Dashboard 集中管理所有表单回复的用户。
6. 需要企业级团队权限、审计、成员管理的公司。

---

## 5. 用户痛点

### 5.1 原始痛点

用户用 Google Forms 收集信息，但团队主要在 Slack 工作。Google Forms 提交后，如果没有提醒，重要信息容易被延迟处理。

### 5.2 使用普通通知工具后的新痛点

普通 Google Forms → Slack 工具会把所有提交都发送到 Slack。随着提交量增加，Slack 频道会产生通知噪音，团队开始忽略通知。

### 5.3 FormAlert 解决的问题

FormAlert 不是解决“能不能发 Slack”，而是解决：

> 哪些 Google Forms 提交值得发送到 Slack？

---

## 6. 核心价值主张

### 6.1 对比 SlackNotify

| 模块 | SlackNotify | FormAlert |
|---|---|---|
| Google Forms → Slack | 支持 | 支持 |
| Slack Webhook | 支持 | 支持 |
| Markdown Message | 支持 | 支持 |
| Custom Payload Messages | 支持 | 支持 |
| 字段变量 | 支持 | 支持 + 字段校验 |
| 字段过滤规则 | 基础或有限 | 核心卖点 |
| skipped 日志 | 弱 | 必做 |
| 错误诊断 | 弱 | 必做 |
| 付费升级 | 授权码/类似机制 | 授权码 |
| Web 端职责 | SEO + 付费 + 文档 | SEO + Creem + 授权码 + 文档 |
| Web 登录 | 不需要 | MVP 不需要 |

### 6.2 核心差异

SlackNotify 更像：

```text
Google Forms submit → Slack notification
```

FormAlert 更像：

```text
Google Forms submit → field filter → Slack notification only if matched
```

---

## 7. MVP 总体范围

### 7.1 Web 端职责

Web 端只负责：

1. Landing Page
2. Pricing Page
3. Monthly / Yearly billing 展示
4. Creem Checkout
5. Creem Webhook
6. 授权码生成与交付
7. Docs / Installation Guide
8. FAQ
9. Privacy Policy
10. Terms of Service
11. Refund Policy
12. Support Page
13. SEO 内容页

Web 端不做：

1. Web Dashboard
2. Google One Tap 登录
3. 用户中心
4. 表单回复管理
5. Slack Webhook 保存
6. Google Form response 保存
7. AI Rule Builder
8. 表单内容分析

### 7.2 插件端职责

插件端负责核心功能：

1. 在 Google Forms response Sheet 中打开 Sidebar
2. 读取当前 Sheet 表头字段
3. 配置 Slack Webhook URL
4. 配置普通 Message 模板
5. 配置 Custom Payload 模板
6. 配置字段过滤规则
7. Test with Latest Response
8. onFormSubmit 触发
9. 执行本地规则判断
10. 直接向 Slack Webhook 发送消息
11. 保存最近日志
12. 输入授权码升级 Standard / Business
13. 根据 Free / Standard / Business 限制功能

---

## 8. 不做 AI 的明确决策

本版本不做 AI Rule Builder。

原因：

1. 字段过滤规则已经足以形成对 SlackNotify 的差异化。
2. 不调用 AI 可以降低开发成本。
3. 不调用 AI 可以降低审核解释成本。
4. 不调用 AI 可以简化 Privacy / Creem 审核材料。
5. 规则判断稳定、可解释、可调试。
6. 避免用户误以为产品会分析真实表单内容。

后续版本可以考虑 AI，但当前 MVP 明确不做。

---

## 9. 产品功能设计

## 9.1 插件入口

推荐第一版做 Google Sheets Add-on，而不是直接做完整 Google Forms 管理器。

原因：

1. Google Forms 的 response 通常会连接到 Google Sheets。
2. 在当前 response Sheet 内读取字段更容易控制权限。
3. 更容易坚持“只作用于当前表格”的低审核风险设计。
4. 更容易使用 `@OnlyCurrentDoc` / current document scope 降低权限范围。

用户路径：

```text
Google Form
→ Link to Google Sheet
→ 打开 Response Sheet
→ Extensions / Add-ons
→ Open FormAlert for Slack
```

---

## 9.2 Sidebar 信息架构

Sidebar 包含以下模块：

1. Welcome / Setup Checklist
2. Slack Webhook
3. Message Mode
4. Payload Mode
5. Filter Rules
6. Test with Latest Response
7. Logs
8. License Code
9. Help / Docs Link

---

## 9.3 Setup Checklist

首次打开插件时展示配置进度。

Checklist：

1. Response Sheet detected
2. Slack Webhook added
3. Message or Payload configured
4. Filter Rule created
5. Test message sent
6. Trigger installed
7. License activated（可选）

作用：降低用户配置迷茫。

---

## 9.4 Slack Webhook 配置

字段：

1. Slack Webhook URL
2. Save Webhook
3. Test Webhook

校验：

1. 不能为空
2. 必须以 `https://hooks.slack.com/services/` 开头
3. 测试发送返回 `ok` 或 2xx 才认为成功

存储：

1. 存在用户自己的 Apps Script PropertiesService
2. 不上传到后端
3. 不进入数据库

错误提示：

1. Webhook URL is missing.
2. This does not look like a Slack Incoming Webhook URL.
3. Slack returned an error. Please copy a fresh webhook URL from Slack.

---

## 9.5 Message Mode

普通文本/Markdown 消息模板。

示例：

```text
New filtered form response

Name: {{Name}}
Email: {{Email}}
Budget: {{Budget}}
Message: {{Message}}
```

功能：

1. 支持 `{{FieldName}}` 变量
2. 支持 Markdown 文本
3. 支持字段变量选择器
4. 支持 Preview
5. 支持 Test with Latest Response

校验：

1. 模板不能为空
2. 未识别变量时提示 warning
3. 字段不存在时不阻止保存，但测试时提示

---

## 9.6 Payload Mode

Payload Mode 兼容 Slack 官方 Block Kit Builder 生成的 payload。

用户流程：

1. 用户打开 Slack Block Kit Builder
2. 选择或编辑 Slack 官方消息模板
3. 复制 payload JSON
4. 粘贴到 FormAlert 的 Payload Template 输入框
5. 在 payload 中插入 `{{FieldName}}` 变量
6. 点击 Validate Payload
7. 使用 latest response 预览和测试

重要原则：

1. 不自建 Slack 模板库
2. 不自建 Block Kit 编辑器
3. 只支持用户粘贴 Slack 官方 payload
4. 插件负责变量替换、JSON 校验、预览、测试

需要支持：

1. JSON payload 校验
2. 字段变量提取
3. 字段存在性检查
4. 安全变量替换
5. 替换后再次 JSON.parse
6. Slack Webhook 发送
7. fallback text 检查

Payload 模式的产品价值：

1. 用户可以继续使用 Slack 官方消息模板。
2. 插件不需要维护模板库。
3. 高级用户可以获得更好的 Slack 消息展示。
4. FormAlert 只在发送前增加过滤规则。

---

## 9.7 字段变量选择器

从当前 response Sheet 的表头读取字段，例如：

```text
Name
Email
Budget
Priority
Message
```

用户点击字段后插入：

```text
{{Budget}}
```

适用于：

1. Message Mode
2. Payload Mode
3. Filter Rule Field 选择

注意：字段变量来自当前 Sheet 表头，不从服务器获取。

---

## 9.8 字段过滤规则

字段过滤规则是 MVP 核心功能。

### 9.8.1 P0 操作符

第一版只支持：

1. equals
2. contains
3. greater_than

### 9.8.2 P1 可扩展操作符

后续可增加：

1. less_than
2. not_equals
3. not_empty
4. contains_any

### 9.8.3 规则结构

```json
{
  "ruleId": "rule_001",
  "ruleName": "High value lead",
  "enabled": true,
  "matchMode": "all",
  "conditions": [
    {
      "field": "Budget",
      "operator": "greater_than",
      "value": "100"
    }
  ],
  "messageMode": "payload",
  "messageTemplate": "",
  "payloadTemplate": "{...}",
  "slackWebhookUrl": "stored locally only"
}
```

### 9.8.4 条件逻辑

支持：

1. all：所有条件满足才发送
2. any：任意条件满足即发送

不支持：

1. 嵌套条件
2. 复杂 AND / OR 分组
3. 正则表达式
4. JavaScript 表达式
5. 自定义代码

### 9.8.5 示例

示例 1：预算大于 100

```text
Field: Budget
Operator: greater_than
Value: 100
```

示例 2：优先级为 High

```text
Field: Priority
Operator: equals
Value: High
```

示例 3：留言包含 refund

```text
Field: Message
Operator: contains
Value: refund
```

---

## 9.9 Test with Latest Response

用户配置完成后，可以使用最新一条真实表单提交测试。

流程：

1. 读取当前 response Sheet 最后一行
2. 转成字段 key-value
3. 执行当前规则
4. 展示是否匹配
5. 渲染 Message 或 Payload
6. 发送到 Slack
7. 写入 test log

注意：

1. 测试不计入 Free 的 30 条正式通知。
2. 测试不上传 response 内容到服务器。
3. 测试只在 Apps Script 内本地处理。

---

## 9.10 onFormSubmit 自动触发

MVP 优先支持绑定到 response Google Sheet 的 installable onFormSubmit trigger。

流程：

```text
Form submitted
→ Google Sheet 新增 response row
→ onFormSubmit(e)
→ 提取本次提交数据
→ 读取 enabled rules
→ 执行规则判断
→ 不匹配：记录 skipped
→ 匹配：渲染 Message / Payload
→ POST 到 Slack Webhook
→ 成功：记录 sent
→ 失败：记录 error
```

---

## 9.11 Logs

本地保存最近日志。

Free：最近 10 条  
Standard：最近 20 条  
Business：最近 50 条

日志字段：

1. timestamp
2. ruleName
3. status: sent / skipped / error / test
4. reason
5. matchedConditions
6. slackResponseCode
7. messagePreview

禁止记录：

1. 完整表单 response
2. Slack Webhook URL
3. 客户敏感信息全集

messagePreview 可以截断到 200 字符。

---

## 9.12 授权码激活

用户购买后获得授权码，在插件内输入授权码升级。

流程：

```text
用户付款
→ 后端生成 License Code
→ 支付成功页展示 License Code
→ 邮件发送 License Code
→ 用户在插件中输入 License Code
→ 插件调用 License API
→ 返回 Free / Standard / Business
→ 解锁功能
```

重要原则：

1. 付款邮箱不需要等于 Google 账号邮箱。
2. 付款邮箱只用于收据和授权码交付。
3. 插件使用授权码升级。
4. MVP 不做 Web 登录。
5. MVP 不做 Google One Tap。

---

## 10. Pricing 设计

完全参考 SlackNotify 的模式：Free + Standard + Business，同时支持 Monthly billing 与 Yearly billing。

## 10.1 Monthly Billing

| Plan | Price | 核心权益 |
|---|---:|---|
| Free | $0/month | 7 day trial, up to 30 Slack notifications, 1 Google Form |
| Standard | $5/month | Unlimited Slack notifications, up to 10 Google Forms per user, Markdown Message & Custom Payload Messages, Filter Rules |
| Business | $8/month | Unlimited Slack notifications, up to 100 Google Forms per user, Markdown Message & Custom Payload Messages, Filter Rules |

## 10.2 Yearly Billing

| Plan | Display Price | Actual Payment | 核心权益 |
|---|---:|---:|---|
| Free | $0/month | $0 | 7 day trial, up to 30 Slack notifications, 1 Google Form |
| Standard | $3.25/month | $39/year | Unlimited Slack notifications, up to 10 Google Forms per user, Markdown Message & Custom Payload Messages, Filter Rules |
| Business | $6.5/month | $79/year | Unlimited Slack notifications, up to 100 Google Forms per user, Markdown Message & Custom Payload Messages, Filter Rules |

说明：

1. Yearly 页面展示的是折算月价。
2. Standard 年付实际一次性支付 $39/year。
3. Business 年付实际一次性支付 $79/year。
4. 月付和年付都需要在 Creem 中分别创建价格。

---

## 10.3 Free 权益

Free：

1. $0/month
2. 7 day trial
3. Up to 30 Slack notifications
4. Use on 1 Google Form / response Sheet
5. Message Mode
6. 1 Filter Rule
7. 最近 10 条日志
8. 5 day refund policy 不适用于 Free，但可在全站退款政策中说明付费计划退款

---

## 10.4 Standard 权益

Standard：

1. $5/month 或 $39/year
2. Unlimited Slack notifications
3. Up to 10 Google Forms per user
4. Markdown Message
5. Custom Payload Messages
6. Filter Rules
7. 每个 form 最多 10 条 rules
8. 每条 rule 最多 3 个 conditions
9. 最近 20 条日志
10. 错误诊断
11. 授权码激活

---

## 10.5 Business 权益

Business：

1. $8/month 或 $79/year
2. Unlimited Slack notifications
3. Up to 100 Google Forms per user
4. Markdown Message
5. Custom Payload Messages
6. Filter Rules
7. 每个 form 最多 20 条 rules
8. 每条 rule 最多 5 个 conditions
9. 最近 50 条日志
10. 错误诊断
11. 优先支持
12. 授权码激活

---

## 11. 付费与 License 后端方案

## 11.1 Creem 产品配置

需要在 Creem 创建 4 个付费价格：

1. Standard Monthly：$5/month
2. Standard Yearly：$39/year
3. Business Monthly：$8/month
4. Business Yearly：$79/year

Free 不走 Creem。

## 11.2 支付成功流程

```text
Pricing Page
→ 用户选择 monthly / yearly
→ 点击 Standard / Business
→ 创建 Creem Checkout
→ 用户填写任意邮箱并付款
→ Creem webhook 通知后端
→ 后端生成 License Code
→ Success Page 展示 License Code
→ 邮件发送 License Code
→ 用户回插件输入 License Code
```

## 11.3 License Code 格式

建议格式：

```text
FA-XXXX-XXXX-XXXX
```

示例：

```text
FA-8K2L-93JD-PRO
```

## 11.4 License 数据结构

```json
{
  "licenseCode": "FA-8K2L-93JD-PRO",
  "buyerEmail": "payer@example.com",
  "plan": "standard",
  "billingCycle": "yearly",
  "status": "active",
  "formsLimit": 10,
  "rulesPerFormLimit": 10,
  "conditionsPerRuleLimit": 3,
  "activatedInstallationIds": [],
  "createdAt": "...",
  "expiresAt": "..."
}
```

## 11.5 插件激活请求

```json
{
  "licenseCode": "FA-8K2L-93JD-PRO",
  "installationId": "inst_xxx",
  "googleEmail": "optional@example.com",
  "spreadsheetIdHash": "hash_xxx"
}
```

注意：

1. `googleEmail` 可选，不作为唯一付费身份。
2. `spreadsheetIdHash` 只用于统计 form / installation 数量。
3. 不上传表单内容。

## 11.6 License 校验逻辑

后端判断：

1. licenseCode 是否存在
2. status 是否 active
3. 是否过期
4. 当前 installationId 是否已激活
5. 如果未激活，检查是否超过 formsLimit
6. 未超过则绑定 installationId
7. 返回 plan 和限制

返回示例：

```json
{
  "valid": true,
  "plan": "standard",
  "billingCycle": "yearly",
  "formsLimit": 10,
  "activatedForms": 3,
  "rulesPerFormLimit": 10,
  "conditionsPerRuleLimit": 3,
  "logLimit": 20
}
```

## 11.7 换绑策略

MVP 阶段采用人工换绑。

用户提供：

1. License Code
2. 付款邮箱
3. 需要释放的旧安装
4. 新 Google 账号或新安装场景

后台人工重置指定 installationId。

暂不做自助换绑页面。

---

## 12. 后端技术方案

## 12.1 推荐技术栈

Web / Backend：

1. Next.js App Router
2. Tailwind CSS
3. Neon Postgres
4. Drizzle ORM
5. Creem Checkout
6. Creem Webhook
7. 邮件服务：Resend / Postmark / 其他
8. 部署：Vercel

插件：

1. Google Apps Script
2. Sidebar.html
3. PropertiesService
4. UrlFetchApp
5. Installable onFormSubmit trigger

## 12.2 API 路由

### POST /api/creem/webhook

功能：处理 Creem 支付与订阅事件。

职责：

1. 校验 webhook signature
2. 记录 raw event
3. 判断 product / price
4. 创建或更新 license
5. 处理 subscription active / canceled / refunded / expired
6. 发送 License Code 邮件

### POST /api/license/verify

功能：插件校验授权码。

输入：

```json
{
  "licenseCode": "FA-XXXX-XXXX-XXXX",
  "installationId": "inst_xxx",
  "spreadsheetIdHash": "hash_xxx"
}
```

输出：

```json
{
  "valid": true,
  "plan": "business",
  "status": "active",
  "formsLimit": 100,
  "activatedForms": 8,
  "rulesPerFormLimit": 20,
  "conditionsPerRuleLimit": 5,
  "logLimit": 50
}
```

### POST /api/license/activate

可与 verify 合并，也可单独实现。

职责：首次绑定 installationId。

### POST /api/license/deactivate-request

MVP 可以先不做自助，只提供支持入口。

### GET /api/health

健康检查。

---

## 12.3 数据库表

### licenses

字段：

1. id
2. license_code
3. buyer_email
4. plan: standard / business
5. billing_cycle: monthly / yearly
6. status: active / canceled / refunded / expired
7. forms_limit
8. rules_per_form_limit
9. conditions_per_rule_limit
10. log_limit
11. creem_customer_id
12. creem_subscription_id
13. current_period_start
14. current_period_end
15. created_at
16. updated_at

### license_installations

字段：

1. id
2. license_id
3. installation_id
4. spreadsheet_id_hash
5. optional_google_email_hash
6. activated_at
7. last_verified_at
8. status: active / removed

### creem_events

字段：

1. id
2. event_id
3. event_type
4. payload_json
5. processed_at
6. created_at

### orders

字段：

1. id
2. creem_order_id
3. buyer_email
4. license_id
5. product_name
6. plan
7. billing_cycle
8. amount
9. currency
10. status
11. created_at

---

## 12.4 后端禁止保存的数据

后端不得保存：

1. Google Form response 内容
2. Google Sheet 行数据
3. Slack Webhook URL
4. Slack payload 模板
5. Slack message 内容
6. 客户姓名、邮箱、预算、留言等 response value

后端只保存商业授权相关数据。

---

## 13. 插件技术方案

## 13.1 文件结构

至少包含：

1. Code.gs
2. Sidebar.html
3. appsscript.json

内部模块建议：

1. ConfigService
2. RuleService
3. RuleEngine
4. SlackService
5. PayloadService
6. TemplateService
7. LicenseClient
8. LogService
9. TriggerService
10. SheetService

## 13.2 本地配置

使用 PropertiesService 保存：

```json
{
  "installationId": "inst_xxx",
  "licenseCode": "FA-XXXX-XXXX-XXXX",
  "cachedPlan": "standard",
  "rules": [],
  "logs": [],
  "freeNotificationCount": 12,
  "lastLicenseCheckAt": "..."
}
```

每条 rule 本地保存：

```json
{
  "ruleId": "rule_xxx",
  "ruleName": "High value lead",
  "enabled": true,
  "matchMode": "all",
  "conditions": [
    {
      "field": "Budget",
      "operator": "greater_than",
      "value": "100"
    }
  ],
  "messageMode": "message",
  "messageTemplate": "New lead: {{Name}} - {{Budget}}",
  "payloadTemplate": "",
  "slackWebhookUrl": "https://hooks.slack.com/services/..."
}
```

## 13.3 字段读取

从当前 response Sheet 第一行读取表头：

```text
Name | Email | Budget | Priority | Message
```

用于：

1. Variable Picker
2. Filter Field 选择
3. 模板变量校验
4. Payload 变量校验

## 13.4 RuleEngine

### equals

规则：标准化字符串后相等。

注意：

1. trim
2. 可默认大小写不敏感
3. MVP 不做复杂 locale 比较

### contains

规则：字段值字符串包含目标字符串。

注意：

1. 默认大小写不敏感
2. 空值返回 false

### greater_than

规则：字段值和 value 都转数字后比较。

注意：

1. 非数字返回 error
2. 支持 `$1,000` 这类简单清洗可以作为 P1
3. MVP 只支持普通数字

## 13.5 PayloadService

功能：

1. 校验 JSON
2. 提取 `{{Field}}` 变量
3. 替换变量
4. 替换后再次 JSON.parse
5. 发送 Slack

注意：

变量替换必须避免破坏 JSON。

建议实现：

1. 用户输入 payload template 字符串
2. 测试时先提取变量
3. 对 response value 做 JSON-safe escape
4. 替换后 JSON.parse
5. parse 成功后 UrlFetchApp.post

## 13.6 SlackService

职责：

1. 发送普通 message payload
2. 发送 custom payload
3. 捕捉 Slack 返回
4. 返回结构化结果

普通 message payload：

```json
{
  "text": "rendered message"
}
```

custom payload：

使用用户粘贴并替换变量后的 JSON。

## 13.7 LogService

本地保留最近 N 条日志。

N 根据 plan：

1. Free：10
2. Standard：20
3. Business：50

---

## 14. Google 审核控制

### 14.1 低风险架构原则

产品必须明确：

```text
当前 Google Sheet
→ Apps Script 本地处理
→ 条件过滤
→ 直接发 Slack Webhook
→ 本地日志
→ 后端只做 License
```

### 14.2 禁止的设计

不得设计：

1. 读取所有 Google Forms
2. 读取 Google Drive
3. 保存 Google Form response 到后端
4. 保存 Slack Webhook 到后端
5. 云端 Dashboard 展示表单数据
6. AI 分析 response 内容
7. Gmail 权限
8. CRM 集成

### 14.3 Privacy 关键文案

必须写明：

1. We do not store Google Form responses.
2. We do not store Slack Webhook URLs.
3. Form response data is processed in your Google Apps Script environment.
4. Slack notifications are sent directly from your Apps Script to your Slack Webhook.
5. Our server only stores license and billing-related information.

---

## 15. Creem 审核控制

Web 端必须准备：

1. Landing Page
2. Pricing Page
3. Terms of Service
4. Privacy Policy
5. Refund Policy
6. Support Page
7. Installation Guide
8. FAQ
9. 产品截图或演示图
10. 清晰交付方式：购买后获得 License Code
11. 清晰退款政策：例如 5 day easy refund policy

避免文案：

1. guaranteed revenue
2. hack / bypass
3. unauthorized access
4. 自动获取用户私密数据
5. 夸大 AI 或自动化能力

---

## 16. Web 页面需求

## 16.1 Landing Page

必须包含：

1. Hero
2. 核心差异：Filtered Slack alerts
3. 痛点：不要把每条表单提交都推到 Slack
4. 3 个功能：Filter Rules / Slack Payload Support / Delivery Logs
5. 使用场景：Sales leads / Customer feedback / Bug reports
6. 隐私承诺：不保存表单内容，不保存 Slack Webhook
7. CTA：Get FormAlert App

## 16.2 Pricing Page

必须包含：

1. Monthly / Yearly toggle
2. Free / Standard / Business 三列
3. 每个版本功能
4. 付款后获得授权码说明
5. 5 day easy refund policy
6. FAQ

## 16.3 Installation Guide

必须说明：

1. 如何创建 Google Form
2. 如何连接 response Sheet
3. 如何安装 Add-on
4. 如何创建 Slack Incoming Webhook
5. 如何配置 Message Mode
6. 如何配置 Payload Mode
7. 如何配置 Filter Rule
8. 如何测试 latest response
9. 如何创建 trigger
10. 常见错误排查

## 16.4 FAQ

必须包含：

1. 付款邮箱必须和 Google 邮箱一致吗？不需要。
2. 授权码如何使用？
3. 可以换账号吗？MVP 阶段联系 support 手动重置。
4. 是否保存表单内容？不保存。
5. 是否保存 Slack Webhook？不保存。
6. 是否支持 Slack Block Kit payload？支持。
7. 是否支持字段过滤？支持。
8. 免费版限制是什么？
9. 如何退款？

---

## 17. 错误状态

必须覆盖：

1. Slack Webhook 为空
2. Slack Webhook 格式错误
3. Slack 返回非 2xx
4. 当前 Sheet 没有字段
5. 当前 Sheet 没有 latest response
6. Filter Field 不存在
7. Filter Value 为空
8. greater_than 遇到非数字
9. Message Template 为空
10. Payload 不是合法 JSON
11. Payload 替换变量后 JSON 损坏
12. Payload 中变量字段不存在
13. License Code 无效
14. License Code 已过期
15. License Code 已超过 form 数量限制
16. Free 通知额度已用完
17. Trigger 未安装

每个错误必须包含：

1. 用户可理解提示
2. 技术原因
3. 下一步修复建议
4. 写入日志

---

## 18. MVP 成功标准

30 天内验证：

1. 100 个 Landing Page 访问
2. 20 个插件安装或手动试用
3. 10 个用户成功配置 Webhook
4. 8 个用户创建 Filter Rule
5. 5 个用户成功发送 Slack 通知
6. 3 个用户付费
7. 至少 1 个用户连续使用 7 天

判断：

1. 有访问无安装：SEO/首页价值表达问题
2. 有安装无配置：插件 onboarding 问题
3. 有配置无发送：Webhook/trigger/test 流程问题
4. 有发送无付费：免费额度太宽或付费价值不清晰
5. 有付费无持续使用：需求频率不足或规则能力不足

---

## 19. 开发里程碑

### M1：插件核心功能

1. Sidebar 打开
2. 读取字段
3. Webhook 保存
4. Message Mode
5. Payload Mode
6. Filter Rule
7. Test with Latest Response
8. Logs

### M2：onFormSubmit 自动触发

1. 创建 trigger
2. 读取提交数据
3. 执行规则
4. 发送 Slack
5. 记录 sent/skipped/error

### M3：License 与付费

1. Creem Checkout
2. Creem Webhook
3. License Code 生成
4. License API
5. 插件端激活
6. plan 限制

### M4：Web 与审核材料

1. Landing
2. Pricing monthly/yearly
3. Docs
4. Privacy
5. Terms
6. Refund
7. Support
8. Marketplace 截图

---

## 20. 验收清单

### 插件验收

- [ ] Sidebar 可以打开
- [ ] 可以读取当前 Sheet 字段
- [ ] 可以保存 Slack Webhook
- [ ] 可以配置 Message Mode
- [ ] 可以配置 Payload Mode
- [ ] Payload JSON 可以校验
- [ ] 可以插入字段变量
- [ ] 可以创建 Filter Rule
- [ ] equals 可用
- [ ] contains 可用
- [ ] greater_than 可用
- [ ] Test with Latest Response 可用
- [ ] 匹配规则时 Slack 收到通知
- [ ] 不匹配规则时不发送通知
- [ ] sent/skipped/error/test 都记录日志
- [ ] Free 通知额度能限制
- [ ] 授权码能激活 Standard/Business
- [ ] Standard/Business 功能限制正确

### Web 验收

- [ ] Landing Page 可访问
- [ ] Pricing Page 有 monthly/yearly toggle
- [ ] Standard 月付 $5/month
- [ ] Standard 年付 $39/year，展示 $3.25/month
- [ ] Business 月付 $8/month
- [ ] Business 年付 $79/year，展示 $6.5/month
- [ ] Creem checkout 可用
- [ ] Creem webhook 可处理
- [ ] 支付成功后生成 License Code
- [ ] License Code 邮件可发送
- [ ] Privacy / Terms / Refund / Support 可访问
- [ ] Installation Guide 可访问
- [ ] FAQ 覆盖邮箱不匹配、授权码、隐私、退款

---

## 21. 最终产品边界

FormAlert 的 MVP 不是 AI 工具，也不是自动化平台，更不是 Slack 模板编辑器。

它的核心是：

```text
SlackNotify + Filter Rules + Logs + License Code
```

最终定位：

> A Google Forms to Slack add-on with field-based filters. Keep SlackNotify-style message and payload support, but only send responses that match your rules.

中文：

> 一个带字段过滤能力的 Google Forms → Slack 插件。保留 SlackNotify 类似的消息和 Payload 支持，但只发送符合规则的表单提交。
