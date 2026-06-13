# FormAlert for Slack 插件端 PRD

版本：v1.2  
范围：Google Sheets / Google Forms Response Sheet 插件端  
参考竞品：SlackNotify App 插件端 UI 与流程  
核心定位：在 SlackNotify 的 Google Forms → Slack 通知能力基础上，增加字段过滤规则；只有匹配条件的表单提交才发送 Slack 通知。  
本次更新：采用「方案 1：表单式 Rule Builder」作为过滤器主交互；不使用管道符语法；过滤规则与 Message / Payload 解耦；插件端不展示完整日志，只保留最近一次状态、Copy debug info、本地最近 10 条 debug log。

---

## 1. 产品目标

### 1.1 一句话定位

**Filtered Slack alerts for Google Forms. Send Slack notifications only when form responses match your rules.**

中文理解：

**给 Google Forms 的 Slack 通知加一层字段过滤规则，只有满足条件的提交才发送 Slack 通知。**

### 1.2 插件端职责

插件端负责真实功能闭环：

1. 在 Google Forms response Sheet 中打开插件 Sidebar。
2. 配置 Slack Webhook URL。
3. 配置普通 Message 模板。
4. 配置 Slack Block Kit Payload 模板。
5. 从当前 Sheet 表头读取字段。
6. 设置字段过滤规则。
7. 使用最新一条 response 测试发送。
8. 在真实表单提交时触发判断。
9. 匹配规则时发送 Slack。
10. 不匹配规则时跳过发送。
11. 记录 sent / skipped / error 状态与本地 debug log。
12. 输入授权码升级 Free / Standard / Business。

### 1.3 插件端不做

第一版不做：

1. AI Rule Builder。
2. Slack OAuth。
3. 自建 Slack Block Kit 模板库。
4. 自建 Slack Block Kit 可视化编辑器。
5. Web Dashboard。
6. 云端保存表单提交内容。
7. 云端保存 Slack Webhook URL。
8. CRM 集成。
9. 多平台通知。
10. 复杂自动化工作流。
11. 运行时 LLM 判断。
12. 管道符过滤语法，例如 `value|value>100`。

---

## 2. 核心用户场景

### 2.1 销售线索筛选

用户用 Google Form 收集客户咨询，不希望每条咨询都打扰 Slack，只希望预算大于 100 的线索进入 Slack。

规则：

```text
Field: Budget
Operator: >
Value: 100
```

结果：

```text
Budget = 150 → sent
Budget = 50  → skipped
```

### 2.2 客户反馈筛选

用户只希望 Message 包含 refund 的提交进入 support channel。

规则：

```text
Field: Message
Operator: contains
Value: refund
```

### 2.3 高优先级请求

用户希望 Priority 等于 High 时通知。

规则：

```text
Field: Priority
Operator: equals
Value: High
```

---

## 3. 产品关键决策

### 3.1 过滤器不放在 Message / Payload 中

过滤器不应该写在 Message 或 Payload 文本里。

错误方向：

```text
{{Budget|Budget>100}}
value|value>100
```

原因：

1. 管道符对非技术用户不友好。
2. 在 Payload JSON 中混入规则语法会增加理解成本。
3. 错误排查困难。
4. 后续 Message / Payload 渲染与过滤判断会耦合。
5. 用户很难分清「规则」和「消息内容」。

正确结构：

```text
Webhook URL
Filter Rule
Message / Payload Template
```

执行顺序：

```text
Google Form response
→ 执行 Filter Rule
→ 不匹配：skipped，不渲染 Message/Payload，不发送 Slack
→ 匹配：渲染 Message/Payload
→ 发送 Slack
→ 写日志
```

### 3.2 采用表单式 Rule Builder

过滤器主交互采用表单式配置：

```text
Field       Operator       Value
Budget      >              100
```

UI 不需要过多解释性文案，不使用复杂句子或自然语言生成。

### 3.3 Message 和 Payload 共用同一套过滤规则

同一条 Notification 下：

1. Filter Rule 决定是否发送。
2. Message Mode 决定普通文本消息内容。
3. Payload Mode 决定 Slack Block Kit 消息内容。
4. 无论 Message 还是 Payload，都使用同一套 Filter Rule。

---

## 4. 功能清单

### 4.1 P0 功能

| 模块 | 功能 | 说明 | 是否进入 MVP |
|---|---|---|---|
| 插件入口 | 自定义菜单 / Sidebar | 在 Google Sheets 中打开插件 | 是 |
| 登录信息 | 显示当前 Google 用户 | 参考 SlackNotify：Logged in as xxx | 是 |
| 计划状态 | 显示 Free / Standard / Business | 显示剩余额度或已升级状态 | 是 |
| 授权码 | 输入 License Code 升级 | 付款邮箱不与 Google 账号强绑定 | 是 |
| 通知列表 | 显示已配置的 Slack Notification | 每条对应一个通知规则 | 是 |
| 新建通知 | 添加 Slack Notification | 类似 SlackNotify 的 Add / Update 页面 | 是 |
| 编辑通知 | 编辑 webhook、模板、过滤规则 | 支持保存和测试 | 是 |
| 删除通知 | 删除已有通知 | 需二次确认 | 是 |
| Slack Webhook | 保存 Webhook URL | 存在 PropertiesService，不上传服务器 | 是 |
| 字段读取 | Refresh Fields | 读取当前 response Sheet 表头 | 是 |
| 字段插入 | Add Form Field | 将字段插入 Message / Payload | 是 |
| Message Mode | 普通文本模板 | 支持 `{{Field}}` 变量 | 是 |
| Payload Mode | Slack Block Kit Payload | 用户从 Slack Block Kit Builder 复制 payload | 是 |
| Payload 校验 | JSON 校验 + 变量校验 | 防止 invalid_payload | 是 |
| 字段过滤 | 数值比较 + 字符串匹配 | 核心差异化 | 是 |
| Test | Send Test / Test with Latest Response | 使用最新 response 测试真实效果 | 是 |
| Trigger | 安装 onFormSubmit trigger | 用于真实表单提交触发 | 是 |
| Status / Debug | 最近一次状态 + Copy debug info | 插件端不展示完整日志列表；本地保留最近 10 条 debug log | 是 |
| 错误诊断 | 明确错误与修复建议 | Webhook、字段、payload、规则错误 | 是 |

### 4.2 P1 功能

| 模块 | 功能 | 说明 |
|---|---|---|
| 多条件规则 | 最多 3 个 conditions | Standard / Business 可用 |
| Trigger 状态检测 | 检查是否已安装触发器 | Setup 区域展示 |
| 表单数量限制 | Free 1 / Standard 10 / Business 100 | 通过 license + installation 记录控制 |
| License 换绑 | 联系客服人工重置 | MVP 可以人工处理 |
| Copy debug info | 复制最近 10 条本地 debug log | 用于客服排查，用户主动复制，不自动上传服务器 |

---

## 5. Pricing 与权限策略

完全参考 SlackNotify 的结构：Free + Standard + Business，支持月付和年付。

### 5.1 定价

| Plan | Monthly Billing | Yearly Billing | 说明 |
|---|---:|---:|---|
| Free | $0/month | $0/month | 7 day trial / 30 notifications |
| Standard | $5/month | $39/year，折算 $3.25/month | 主力付费版本 |
| Business | $8/month | $79/year，折算 $6.5/month | 更高表单数量版本 |

### 5.2 功能限制

| 功能 | Free | Standard | Business |
|---|---:|---:|---:|
| Google Forms / response Sheets | 1 | 10 | 100 |
| Slack notifications | Up to 30 | Unlimited | Unlimited |
| Slack Webhook | 1 | 多个 | 多个 |
| Message Mode | 支持 | 支持 | 支持 |
| Payload Mode | 可限制或不开放 | 支持 | 支持 |
| Filter Rules | 1 | 10 | 100 |
| Conditions per rule | 1 | 3 | 3 |
| Debug logs | 本地最近 10 条 | 本地最近 10 条 | 本地最近 10 条 |
| License Code | 不需要 | 需要 | 需要 |
| Refund policy | 参考官网 | 5 day easy refund policy | 5 day easy refund policy |

---

## 6. 插件端信息架构

插件端采用类似 SlackNotify 的窄 Sidebar 布局，优先适配 Google Sheets 右侧面板宽度。

页面列表：

1. Main / Dashboard
2. Create Notification
3. Edit Notification
4. Message Tab
5. Payload Tab
6. Filter Rule Section
7. Status / Debug Section
8. License / Upgrade Section
9. Help / How to Add

---

## 7. UI 设计与交互

### 7.1 全局布局风格

参考 SlackNotify：

- 顶部紫色 Header。
- 左侧显示应用名。
- 右侧显示最小化 / 关闭按钮。
- 内容区为表单控件。
- 主按钮使用黄色或深色。
- 页面宽度按 Google Sidebar 约 280px 设计。
- 操作按钮高度统一。
- 信息密度高，但保持分块清晰。

---

## 7.2 Main / Dashboard 页面

### 目标

让用户快速看到：

1. 当前登录账号。
2. 当前 plan / credits。
3. 已配置通知列表。
4. 是否需要升级。
5. 最近 3 条通知配置。
6. 搜索入口和 View all 分页入口。
7. 自动提醒状态。

### ASCII 布局

```text
+--------------------------------------+
| FORMALERT FOR SLACK              _ x |
+--------------------------------------+
| Logged in as: user@gmail.com         |
| Plan: Free       25 credits left     |
|                         [Upgrade]    |
|--------------------------------------|
| Slack Notifications                  |
| [ Search notifications...          ] |
| [ + Add Notification ]               |
|--------------------------------------|
| Recent                               |
|--------------------------------------|
| Chinese101 Feedback Form             |
| Budget > 100              [Edit][Del]|
|--------------------------------------|
| Support Request Form                 |
| Message contains refund   [Edit][Del]|
|--------------------------------------|
| Course Signup Form                   |
| Priority equals High      [Edit][Del]|
|--------------------------------------|
| [ View all notifications ]           |
|--------------------------------------|
| Automatic alerts: Enabled            |
| Last status: sent                    |
| [Copy debug info]                    |
|                                      |
| Help                                 |
| [How to get Slack Webhook]           |
| [How to use Payload Mode]            |
+--------------------------------------+
```

---

## 7.2.1 All Notifications 页面

当用户点击 `View all notifications` 后进入完整列表。Business 最多支持 100 个 Google Forms / response Sheets，因此完整列表必须支持搜索和分页。

### ASCII 布局

```text
+--------------------------------------+
| All Notifications              Back  |
+--------------------------------------+
| [ Search...                      ]   |
|--------------------------------------|
| Chinese101 Feedback Form             |
| Budget > 100              [Edit][Del]|
|--------------------------------------|
| Support Request Form                 |
| Message contains refund   [Edit][Del]|
|--------------------------------------|
| Course Signup Form                   |
| Priority equals High      [Edit][Del]|
|--------------------------------------|
| Page 1 / 10        [Prev] [Next]     |
+--------------------------------------+
```

### 列表规则

1. Main 首页只显示最近编辑的 3 条 notification。
2. All Notifications 每页显示 10 条。
3. 搜索范围：notification name / filter summary。
4. 不显示 last sent time / last skipped time。
5. 不显示 message preview。
6. 列表项只展示：名称、过滤摘要、Edit、Delete。

---

## 7.2.2 Automatic Alerts 状态

用户不应该理解 `installable trigger` 概念，因此不在首页放置明显的 `Install Form Submit Trigger` 按钮。

插件行为：

```text
用户首次保存 notification
→ 插件自动检查 form submit trigger
→ 如果不存在，自动创建 trigger
→ 成功后显示 Automatic alerts: Enabled
→ 失败时显示 Automatic alerts need setup + Fix setup
```

### 状态展示

```text
Automatic alerts: Enabled
```

失败时：

```text
Automatic alerts need setup
[Fix setup]
```

说明：

1. `Fix setup` 只在自动安装失败时出现。
2. 触发器安装失败需要给出简短原因。
3. 不向普通用户解释 trigger 技术概念。

---

## 7.3 Create / Edit Notification 页面

### 目标

让用户完成一条通知规则的完整配置。

### ASCII 布局

```text
+--------------------------------------+
| FORMALERT FOR SLACK              _ x |
+--------------------------------------+
| Create Notification                  |
| [ ? How to add ]              [Back] |
|--------------------------------------|
| Notification Name                    |
| [ High value lead alert            ] |
|                                      |
| Webhook Url                          |
| [ https://hooks.slack.com/services ] |
|                                      |
| Add Form Field        [Refresh Fields]|
| [ Budget                         v ] |
| [ Insert Field ]                     |
|                                      |
| Filter                               |
| [ Field      v ] [ Operator v ]      |
| [ Value                              ]|
| [+ Add Filter]                       |
|                                      |
| Message Type                         |
| [ Message ] [ Payload ]              |
|                                      |
| < Message/Payload Editor Area >      |
|                                      |
| [Save]              [Send Test]      |
+--------------------------------------+
```

交互说明：

| 操作 | 结果 |
|---|---|
| Refresh Fields | 重新读取当前 Sheet 表头 |
| Insert Field | 将 `{{SelectedField}}` 插入当前编辑器光标处 |
| Message Tab | 切换普通文本模板 |
| Payload Tab | 切换 Block Kit payload 模板 |
| Add Filter | 增加一条过滤条件，受 plan 限制 |
| Save | 校验并保存 |
| Send Test | 使用最新 response 测试 |
| Back / Cancel | 返回 Main |

---

## 7.4 Filter Rule UI

### 目标

用最少文案表达字段过滤，不使用管道符。

### MVP UI

```text
+--------------------------------------+
| Filter                               |
|--------------------------------------|
| [ Budget        v ] [ >          v ] |
| [ 100                              ] |
|                                      |
| [+ Add Filter]                       |
+--------------------------------------+
```

### 多条件 UI

当有多条条件时：

```text
+--------------------------------------+
| Filter                               |
|--------------------------------------|
| [ Budget        v ] [ >          v ] |
| [ 100                              ] |
|                                      |
| [ Priority      v ] [ equals     v ] |
| [ High                             ] |
|                                      |
| [ Match: all v ]                     |
| [+ Add Filter]                       |
+--------------------------------------+
```

说明：

1. 单条件时不显示 Match。
2. 多条件时才显示 Match。
3. Match 下拉只显示两个值：`all`、`any`。
4. 不显示过多解释性文案，例如 “All conditions / Any condition”。
5. Free 只允许 1 条 filter。
6. Standard / Business 最多 3 条 filter。

### Operator UI

数值字段显示：

```text
=
≠
>
<
>=
<=
```

字符串字段显示：

```text
contains
equals
```

注意：

1. 操作符 UI 可以用符号，节省 Sidebar 空间。
2. 内部保存仍然使用结构化 operator。
3. 字段类型由系统自动识别，也允许用户手动切换字段类型。

---

## 7.5 字段类型识别

### 自动识别逻辑

系统读取当前 response Sheet 最近 10 行：

```text
如果某字段的大多数非空值可以转为数字 → number
否则 → text
```

### 字段类型影响

number 字段：

```text
=, ≠, >, <, >=, <=
```

text 字段：

```text
contains, equals
```

### 手动修正

在过滤器高级区域提供字段类型切换：

```text
Type: [Auto v]
可选：Auto / Number / Text
```

MVP 中可以先隐藏，只在字段识别错误时通过后续版本开放。

---

## 7.6 Message Tab

### ASCII 布局

```text
+--------------------------------------+
| Message                              |
|--------------------------------------|
| New filtered form response           |
|                                      |
| Name: {{Name}}                       |
| Email: {{Email}}                     |
| Budget: {{Budget}}                   |
| Message: {{Message}}                 |
|                                      |
|--------------------------------------|
| Preview                              |
|--------------------------------------|
| New filtered form response           |
| Name: Tom                            |
| Email: tom@example.com               |
| Budget: 150                          |
| Message: I need refund               |
+--------------------------------------+
```

校验规则：

1. Message 模板不能为空。
2. 变量格式必须为 `{{FieldName}}`。
3. 找不到字段时 warning。
4. 可以保存，但 Test 时必须提示变量不存在。

---

## 7.7 Payload Tab

### 目标

兼容 Slack Block Kit Builder 的 JSON payload。  
用户在 Slack 官方 Builder 中生成 payload，复制到插件中，然后插入表单字段变量。

### ASCII 布局

```text
+--------------------------------------+
| Payload                              |
|--------------------------------------|
| Paste Slack Block Kit payload below  |
| [Open Slack Block Kit Builder ↗]     |
|                                      |
| {                                    |
|   "text": "New response {{Name}}", |
|   "blocks": [                       |
|     {                                |
|       "type": "section",           |
|       "text": {                     |
|         "type": "mrkdwn",          |
|         "text": "*Budget:* {{Budget}}"|
|       }                              |
|     }                                |
|   ]                                  |
| }                                    |
|                                      |
| [Validate Payload]                   |
| JSON: Valid                          |
| Variables: Name, Budget              |
|                                      |
| [Save]              [Send Test]      |
+--------------------------------------+
```

Payload 规则：

1. 必须是合法 JSON。
2. 必须包含 `text` 或 `blocks`。
3. 推荐自动检查顶层 `text` 是否存在。
4. 替换变量后必须仍是合法 JSON。
5. 特殊字符必须正确转义。
6. Slack 返回 invalid_payload 时写 error log。

---

## 7.8 Status / Debug Section

插件端不展示完整日志列表，只保留轻量状态和调试信息入口。

### ASCII 布局

```text
+--------------------------------------+
| Status                               |
|--------------------------------------|
| Last status: sent                    |
| Automatic alerts: Enabled            |
|                                      |
| [Copy debug info]                    |
+--------------------------------------+
```

### 显示规则

1. 只显示最近一次状态：sent / skipped / error / test。
2. 不显示完整发送时间列表。
3. 不显示完整 message preview。
4. 不显示表单字段值。
5. `Copy debug info` 复制本地最近 10 条 debug log。
6. debug log 默认保存在用户自己的 Apps Script PropertiesService 中。
7. debug log 不自动上传服务器。

### Copy debug info 内容

复制内容用于用户主动发给客服排查问题。应包含：

```text
appVersion
installationId
plan
lastStatus
recentDebugLogs
triggerStatus
notificationCount
```

不得包含：

```text
Slack Webhook URL
完整表单提交内容
客户姓名 / 邮箱 / 留言
完整替换后的 payload
完整 Slack message
```

---

## 7.9 License / Upgrade Section

### ASCII 布局

```text
+--------------------------------------+
| Plan & License                       |
|--------------------------------------|
| Current plan: Free                   |
| Credits left: 25 / 30                |
|                                      |
| License Code                         |
| [ FA-XXXX-XXXX-XXXX              ]   |
| [Activate]                           |
|                                      |
| Need more forms and unlimited alerts?|
| [Upgrade to Standard]                |
| [View Pricing ↗]                     |
+--------------------------------------+
```

---

## 8. 过滤器详细设计

### 8.1 过滤器与 Message / Payload 的关系

过滤器是 Notification 级别配置，不属于 Message 或 Payload。

结构：

```json
{
  "name": "High value lead",
  "webhookUrl": "...",
  "filter": {
    "match": "all",
    "conditions": [
      {
        "field": "Budget",
        "fieldType": "number",
        "operator": ">",
        "value": "100"
      }
    ]
  },
  "message": {
    "mode": "payload",
    "textTemplate": "New response from {{Name}}",
    "payloadTemplate": "{...}"
  }
}
```

执行：

```text
filter pass → render message/payload → send Slack
filter fail → skipped log only
filter error → error log only
```

### 8.2 数值规则

支持：

| UI | 内部 operator | 说明 |
|---|---|---|
| = | eq | 等于 |
| ≠ | neq | 不等于 |
| > | gt | 大于 |
| < | lt | 小于 |
| >= | gte | 大于等于 |
| <= | lte | 小于等于 |

判断要求：

1. 字段值和目标值都必须能转成数字。
2. 如果无法转数字，返回 error。
3. 支持去除 `$`、`,`、空格。
4. 空值视为 error。

### 8.3 字符串规则

支持：

| UI | 内部 operator | 说明 |
|---|---|---|
| contains | contains | 包含 |
| equals | text_eq | 等于 |

判断要求：

1. 默认大小写不敏感。
2. 前后空格自动 trim。
3. 空字符串不匹配。
4. contains 用普通字符串包含，不用正则。
5. 第一版不支持 contains_any。

### 8.4 多条件规则

限制：

1. Free：最多 1 条 condition。
2. Standard / Business：最多 3 条 conditions。
3. 单条件不显示 Match。
4. 多条件显示 Match 下拉：all / any。
5. 不支持嵌套条件。
6. 不支持自定义表达式。

---

## 9. 核心数据结构

### 9.1 本地配置

使用 Apps Script `PropertiesService` 保存。

```json
{
  "installationId": "inst_xxx",
  "licenseCode": "FA-XXXX-XXXX-XXXX",
  "cachedPlan": "free",
  "cachedPlanCheckedAt": "2026-06-09T00:00:00Z",
  "notifications": [],
  "debugLogs": [],
  "freeCreditsUsed": 5,
  "triggerInstalled": true
}
```

### 9.2 Notification 配置

```json
{
  "id": "notif_xxx",
  "name": "High value lead",
  "enabled": true,
  "webhookUrl": "https://hooks.slack.com/services/xxx",
  "messageType": "payload",
  "messageTemplate": "New response from {{Name}}",
  "payloadTemplate": "{...}",
  "filter": {
    "match": "all",
    "conditions": [
      {
        "field": "Budget",
        "fieldType": "number",
        "operator": "gt",
        "value": "100"
      }
    ]
  },
  "createdAt": "2026-06-09T00:00:00Z",
  "updatedAt": "2026-06-09T00:00:00Z"
}
```

---

## 10. 插件端技术方案

### 10.1 技术栈

1. Google Apps Script
2. HTML Service Sidebar
3. PropertiesService
4. SpreadsheetApp
5. ScriptApp installable trigger
6. UrlFetchApp
7. Google Sheets response sheet

### 10.2 文件结构

```text
Code.gs
Sidebar.html
appsscript.json
```

如需拆分：

```text
ConfigService.gs
NotificationService.gs
FieldService.gs
RuleEngine.gs
SlackService.gs
PayloadService.gs
DebugService.gs
LicenseService.gs
TriggerService.gs
```

---

## 11. 关键服务设计

### 11.1 FieldService

职责：

1. 读取当前 Sheet 第一行表头。
2. 返回字段列表。
3. 基于最近 10 行推断字段类型。
4. 检查模板变量是否存在。
5. 获取 latest response。

### 11.2 RuleEngine

职责：

1. 执行数值规则：eq / neq / gt / lt / gte / lte。
2. 执行字符串规则：contains / text_eq。
3. 执行 match all / any。
4. 返回 matched / skipped / error。

返回示例：

```json
{
  "matched": true,
  "status": "matched",
  "reason": "Budget 150 > 100"
}
```

### 11.3 MessageRenderer

职责：

1. 替换 `{{Field}}` 变量。
2. 生成普通 text message。
3. 生成 message preview。
4. 检测变量缺失。

### 11.4 PayloadService

职责：

1. 校验 payload JSON。
2. 提取 payload 中变量。
3. 替换变量。
4. 替换后再次 JSON.parse。
5. 返回 Slack payload object。
6. 处理特殊字符转义。

### 11.5 SlackService

职责：

1. 校验 Webhook URL 格式。
2. POST 到 Slack Webhook。
3. 处理 Slack 返回。
4. 返回 responseCode / body。

---

## 12. onFormSubmit 执行流程

```text
Google Form submit
    ↓
Response 写入当前 Sheet
    ↓
onFormSubmit(e)
    ↓
extractResponseMap(e)
    ↓
读取 notifications
    ↓
过滤 enabled notifications
    ↓
逐条执行 RuleEngine
    ↓
不匹配：write skipped log
    ↓
匹配：渲染 message 或 payload
    ↓
SlackService.send()
    ↓
成功：write sent log
    ↓
失败：write error log
```

伪代码：

```javascript
function onFormSubmit(e) {
  const responseMap = extractResponseMap(e);
  const notifications = getEnabledNotifications();

  notifications.forEach(notification => {
    const ruleResult = RuleEngine.evaluate(notification.filter, responseMap);

    if (ruleResult.error) {
      DebugService.writeError(notification, ruleResult.reason);
      return;
    }

    if (!ruleResult.matched) {
      DebugService.writeSkipped(notification, ruleResult.reason);
      return;
    }

    const payload = renderNotification(notification, responseMap);
    const result = SlackService.send(notification.webhookUrl, payload);

    if (result.ok) {
      DebugService.writeSent(notification, result);
    } else {
      DebugService.writeError(notification, result.error);
    }
  });
}
```

---

## 13. Test with Latest Response 流程

```text
用户点击 Send Test
    ↓
读取当前 Sheet 最新一行
    ↓
转为 responseMap
    ↓
执行当前 notification 的 filter
    ↓
如果不匹配：显示 skipped preview
    ↓
如果匹配：渲染 message/payload
    ↓
发送 Slack
    ↓
写 test log
```

注意：

1. Test 应该真实发送 Slack。
2. Test 不计入 Free credits。
3. 如果没有 response，提示用户先提交一条测试表单。

---

## 14. 错误状态设计

| 错误 | 触发条件 | 用户提示 |
|---|---|---|
| Webhook missing | 未填写 Webhook | Please enter a Slack Webhook URL. |
| Invalid webhook | URL 不符合 hooks.slack.com/services | This does not look like a valid Slack Webhook URL. |
| Slack failed | Slack 返回非 2xx | Slack returned an error. Please check your webhook. |
| No fields | 当前 Sheet 没有表头 | No form fields found. Please open a response Sheet. |
| Field not found | 规则字段不存在 | This field no longer exists in your form. Refresh fields. |
| Empty value | 规则值为空 | Please enter a value for this filter. |
| Not a number | 数值规则遇到非数字 | This filter requires a number. |
| Empty template | Message 为空 | Message template cannot be empty. |
| Invalid payload | Payload 不是合法 JSON | Payload JSON is invalid. Please check Block Kit payload. |
| Missing variable | 模板变量不存在 | This variable does not match any form field. |
| Trigger missing | 未安装 trigger | Install the form submit trigger to enable automatic alerts. |
| License invalid | 授权码无效 | License code is invalid or expired. |
| Free limit reached | Free 通知用完 | Free limit reached. Upgrade to continue sending alerts. |

---

## 15. Debug Log 策略

### 15.1 插件端日志

插件端只保留：

1. 最近一次状态。
2. Copy debug info 按钮。
3. 本地最近 10 条 debug log。

本地 debug log 可包含用于排查的技术信息，但不应在主界面完整展示。

### 15.2 服务器端日志

如果后续需要服务器端日志，只允许存 operational metadata：

```json
{
  "timestamp": "2026-06-09T12:00:00Z",
  "installationId": "inst_xxx",
  "notificationId": "notif_xxx",
  "status": "sent | skipped | error | test",
  "reasonCode": "RULE_NOT_MATCHED | SLACK_ERROR | PAYLOAD_INVALID",
  "slackResponseCode": 200,
  "appVersion": "1.0.0"
}
```

服务器端日志禁止保存：

1. Google Form response 内容。
2. Slack Webhook URL。
3. 完整 Message。
4. 完整 Payload。
5. 替换变量后的 Payload。
6. 客户姓名、邮箱、留言、预算等字段值。

---

## 16. 安全与隐私边界

必须遵守：

1. 不上传 Google Form response 内容到服务器。
2. 不上传 Slack Webhook URL 到服务器。
3. Slack Webhook 存在用户自己的 Apps Script PropertiesService。
4. 通知判断在 Apps Script 内执行。
5. Slack 通知直接从 Apps Script 发往 Slack Webhook。
6. 后端只做 license code 校验。
7. 插件不读取 Google Drive。
8. 插件不读取全部 Google Forms。
9. 插件只围绕当前 response Sheet 工作。
10. 不使用 AI 处理规则或表单内容。

---

## 17. 测试方案

### 16.1 开发测试

使用 Apps Script Test Deployment 测试：

1. Sidebar 是否打开。
2. 字段是否读取。
3. 字段类型是否识别。
4. 配置是否保存。
5. Test with Latest Response 是否成功。
6. Message / Payload 是否发送。
7. Filter 是否生效。
8. Logs 是否记录。

### 16.2 真实测试

使用 Private Marketplace 或内部发布测试：

1. 插件安装。
2. 授权。
3. Sidebar 打开。
4. 自动启用 alerts / 失败时 Fix setup。
5. 真实 Google Form 提交。
6. onFormSubmit 自动触发。
7. Slack 收到消息。
8. skipped 不发送。
9. error 可诊断。

---

## 18. 验收标准

### 17.1 UI 验收

- [ ] Sidebar 可打开。
- [ ] Main 页面显示登录邮箱。
- [ ] Main 页面显示当前 plan / credits。
- [ ] Notification 列表可展示。
- [ ] 可新建 notification。
- [ ] 可编辑 notification。
- [ ] 可删除 notification。
- [ ] 可刷新字段。
- [ ] 可插入字段变量。
- [ ] Message / Payload tab 可切换。
- [ ] Filter Rule 可配置。
- [ ] 数值字段显示数值操作符。
- [ ] 文本字段显示文本操作符。
- [ ] 单条件不显示 Match。
- [ ] 多条件显示 Match: all / any。
- [ ] 最近一次状态可查看。
- [ ] Copy debug info 可用。
- [ ] License Code 可激活。

### 17.2 功能验收

- [ ] Slack Webhook 可保存。
- [ ] Message Mode 可发送。
- [ ] Payload Mode 可发送。
- [ ] Payload JSON 无效时可提示。
- [ ] 数值 `=` 可判断。
- [ ] 数值 `≠` 可判断。
- [ ] 数值 `>` 可判断。
- [ ] 数值 `<` 可判断。
- [ ] 数值 `>=` 可判断。
- [ ] 数值 `<=` 可判断。
- [ ] 字符串 `contains` 可判断。
- [ ] 字符串 `equals` 可判断。
- [ ] Test with Latest Response 可发送。
- [ ] 不匹配规则时 skipped。
- [ ] 真实表单提交可触发 onFormSubmit。
- [ ] 匹配时 Slack 收到消息。
- [ ] 不匹配时 Slack 不收到消息。
- [ ] sent / skipped / error 更新最近一次状态。
- [ ] sent / skipped / error 写入本地最近 10 条 debug log。
- [ ] Trigger 可安装且不重复。
- [ ] Free / Standard / Business 限制可生效。

### 17.3 审核边界验收

- [ ] 不上传 response 内容。
- [ ] 不上传 webhook。
- [ ] 不使用 AI。
- [ ] 不使用 Drive 权限。
- [ ] 不使用 Gmail 权限。
- [ ] 只作用于当前 response Sheet。
- [ ] Privacy 文案与实际一致。

---

## 19. 插件端开发优先级

### Milestone 1：基础 UI 与配置

1. Sidebar 框架。
2. Main 页面。
3. Create / Edit 页面。
4. Field Refresh。
5. Webhook 保存。
6. Message Mode 保存。

### Milestone 2：过滤与测试

1. Filter Rule UI。
2. 字段类型识别。
3. RuleEngine。
4. Test with Latest Response。
5. Message 渲染。
6. Slack 发送。
7. 最近一次状态与 Copy debug info。

### Milestone 3：Payload Mode

1. Payload 编辑。
2. JSON 校验。
3. 变量校验。
4. Payload 渲染。
5. Slack Block Kit 测试。

### Milestone 4：Trigger 与真实提交

1. Install Trigger。
2. Trigger 状态检测。
3. onFormSubmit。
4. sent / skipped / error 状态与本地 debug log。
5. 重复 trigger 防护。

### Milestone 5：License Mock / API 接入

1. Mock Free / Standard / Business。
2. License Code 输入。
3. License API 接入。
4. Plan 限制。

---

## 20. 最终产品边界

这个插件端 MVP 的核心不是重新实现 SlackNotify 的全部功能，而是在 SlackNotify 已验证的通知链路前增加一个明确过滤层：

```text
Google Forms response
→ Field filter rule
→ Message / Payload render
→ Slack Webhook
```

核心差异化：

```text
SlackNotify：表单提交后发送 Slack 通知。
FormAlert：只有表单字段满足条件时才发送 Slack 通知。
```

插件端开发必须始终围绕这个核心价值，不要扩展到 AI、Dashboard、CRM、多平台或复杂工作流。
