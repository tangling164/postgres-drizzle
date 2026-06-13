# FormAlert for Slack 插件端 PRD v1.3 — Forms-first

版本：v1.3  
范围：Google Forms Editor Add-on 插件端  
本次更新：插件主入口改为 **Google Forms 页面右上角插件按钮**。Google Sheets / Response Sheet 不再是第一版主入口，只作为后续补充或调试辅助。  
参考竞品：SlackNotify App 在 Google Forms 页面中的插件入口与 Sidebar 交互。

---

## 1. 核心目标

用户在 Google Forms 编辑页点击右上角插件按钮，打开 FormAlert Sidebar，配置：

1. Slack Webhook URL
2. 字段过滤规则
3. Message / Payload 模板
4. 测试发送
5. 自动表单提交通知

真实表单提交后：

```text
Google Form submit
→ Form submit trigger
→ 读取本次 response
→ 执行 Filter Rule
→ 匹配：渲染 Message/Payload 并发送 Slack
→ 不匹配：skipped
→ 更新 lastStatus + 本地 debug log
```

核心差异化：

```text
SlackNotify：表单提交后发送 Slack 通知。
FormAlert：只有表单字段满足条件时才发送 Slack 通知。
```

---

## 2. 产品边界

### 2.1 第一版必须做

1. Google Forms 插件入口。
2. 在 Google Forms 页面打开 Sidebar。
3. 从当前 Google Form 读取问题字段。
4. 配置 Slack Webhook。
5. 配置 Filter Rule。
6. 配置 Message Mode。
7. 配置 Payload Mode。
8. 使用最新一条 Form response 测试。
9. 保存第一条 notification 后自动安装 form submit trigger。
10. 真实表单提交后自动发送或 skipped。
11. 显示最近一次状态。
12. 支持 Copy debug info。
13. 本地保留最近 10 条 debug log。
14. Mock License：FREE / STANDARD-TEST / BUSINESS-TEST。

### 2.2 第一版不做

1. Google Sheets 作为主入口。
2. Web Dashboard。
3. Creem。
4. 真实 License API。
5. AI Rule Builder。
6. 管道符过滤语法。
7. Slack OAuth。
8. 服务器端日志。
9. 云端保存表单内容。
10. 云端保存 Slack Webhook。
11. 插件端完整 Log 页面。
12. Gmail / Drive 权限。

---

## 3. 插件入口

### 3.1 主入口

插件必须作为 **Google Forms Editor Add-on** 工作。

用户入口：

```text
Google Forms 编辑页
→ 右上角插件按钮
→ FormAlert for Slack
→ 打开 Sidebar
```

### 3.2 不再使用 Sheets-first

旧方案：

```text
Google Form
→ Response Sheet
→ Google Sheets 插件 Sidebar
```

新方案：

```text
Google Form
→ Google Forms 插件 Sidebar
```

原因：

1. 更接近 SlackNotify。
2. 用户在创建表单时即可配置 Slack 通知。
3. 不需要教育用户进入 response Sheet。
4. 更符合 Google Forms 工具场景。

---

## 4. 字段来源

### 4.1 字段读取

字段不再来自 Sheet 第一行表头，而来自当前 Google Form 的问题列表。

技术方向：

```javascript
const form = FormApp.getActiveForm();
const items = form.getItems();
```

UI 显示字段标题：

```text
Name
Email
Budget
Priority
Message
What did you think about Chinese101?
```

### 4.2 内部字段标识

不要只用题目标题作为唯一 key，因为用户可能创建重复问题标题。

内部保存：

```json
{
  "fieldId": "123456789",
  "fieldTitle": "Budget",
  "fieldType": "number"
}
```

UI 显示 `fieldTitle`，规则执行优先用 `fieldId` 匹配 item response。

### 4.3 不支持字段类型

MVP 可先不支持或降级为 text：

1. File upload
2. Grid
3. Date / Time 可先作为 text
4. Checkbox 多选转为逗号分隔文本

---

## 5. Main / Dashboard 页面

首页只显示最近 3 个 notification，不显示发送时间，不展示完整 log。

### ASCII 布局

```text
+--------------------------------------+
| FORMALERT FOR SLACK              _ x |
+--------------------------------------+
| Logged in as: user@gmail.com         |
| Plan: Free                 [Upgrade] |
| Credits left: 25 / 30                |
|                                      |
| Notifications                        |
| [ Search...                       ]  |
|                                      |
| Recent                               |
|--------------------------------------|
| Chinese101 Feedback Form             |
| Budget > 100                         |
| Enabled                  [Edit][Del] |
|--------------------------------------|
| Support Request                      |
| Message contains refund              |
| Enabled                  [Edit][Del] |
|--------------------------------------|
| Course Signup                        |
| Priority equals High                 |
| Disabled                 [Edit][Del] |
|--------------------------------------|
| [ + Add Notification ]               |
| [ View all notifications ]           |
|                                      |
| Automatic alerts: Enabled            |
| Last status: sent                    |
| [Copy debug info]                    |
+--------------------------------------+
```

### 交互

| 操作 | 结果 |
|---|---|
| Add Notification | 进入 Create 页面 |
| Edit | 编辑 notification |
| Delete | 二次确认后删除 |
| View all notifications | 进入分页列表 |
| Search | 搜索 notification/form 名称 |
| Copy debug info | 复制最近 10 条本地 debug log |

---

## 6. All Notifications 页面

Business 最多支持 100 个表单/notification，因此完整列表必须支持搜索和分页。

```text
+--------------------------------------+
| All Notifications               Back |
+--------------------------------------+
| [ Search...                      ]   |
|                                      |
| Chinese101 Feedback Form             |
| Budget > 100              [Edit][Del]|
|--------------------------------------|
| Support Request                      |
| Message contains refund   [Edit][Del]|
|--------------------------------------|
| Course Signup                        |
| Priority equals High      [Edit][Del]|
|--------------------------------------|
| Page 1 / 10        [Prev] [Next]     |
+--------------------------------------+
```

规则：

1. 首页最多显示 3 条。
2. All Notifications 每页 10 条。
3. 搜索使用本地字符串 contains。
4. 不显示 last sent time。
5. 不显示完整日志。

---

## 7. Create / Edit Notification 页面

```text
+--------------------------------------+
| FORMALERT FOR SLACK              _ x |
+--------------------------------------+
| Create Notification            [Back]|
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

---

## 8. Filter Rule

### 8.1 交互

采用表单式 Rule Builder，不使用管道符。

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

多条件时：

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

规则：

1. 单条件不显示 Match。
2. 多条件显示 `Match: all / any`。
3. 不使用过多解释性文案。
4. Free 最多 1 条 filter。
5. Standard / Business 最多 3 条 filter。

### 8.2 数值操作符

```text
=
≠
>
<
>=
<=
```

内部 operator：

```text
eq
neq
gt
lt
gte
lte
```

数值判断要求：

1. 字段值和目标值必须可转为数字。
2. 自动去除 `$`、`,`、空格。
3. 非数字返回 error。
4. 空值返回 skipped 或 error，MVP 统一按 error 处理。

### 8.3 字符串操作符

```text
contains
equals
```

内部 operator：

```text
contains
text_eq
```

字符串判断要求：

1. 默认大小写不敏感。
2. 自动 trim。
3. contains 不使用正则。
4. 空字符串不匹配。

---

## 9. Message Mode

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
| Preview                              |
| New filtered form response           |
| Name: Tom                            |
| Budget: 150                          |
+--------------------------------------+
```

要求：

1. 支持 `{{FieldTitle}}` 变量。
2. 优先用 fieldId 匹配，显示上使用 fieldTitle。
3. Message 不能为空。
4. 缺失变量 Test 时提示 error。

---

## 10. Payload Mode

兼容 Slack Block Kit Builder JSON payload。

```text
+--------------------------------------+
| Payload                              |
|--------------------------------------|
| [Open Slack Block Kit Builder ↗]     |
|                                      |
| {                                    |
|   "text": "New response {{Name}}",   |
|   "blocks": [                        |
|     { "type": "section", ... }       |
|   ]                                  |
| }                                    |
|                                      |
| [Validate Payload]                   |
| JSON: Valid                          |
| Variables: Name, Budget              |
+--------------------------------------+
```

要求：

1. 保存前 JSON 校验。
2. Send Test 前再次校验。
3. 替换变量后仍必须是合法 JSON。
4. 不保存或上传替换后的 payload。
5. Slack 返回 invalid_payload 时更新 lastStatus 和 debug log。

---

## 11. Trigger 设计

### 11.1 用户不感知 trigger

不在首页展示 `Install Form Submit Trigger` 按钮。

用户保存第一条 notification 后：

```text
saveNotification()
→ ensureFormSubmitTrigger()
→ 成功：Automatic alerts: Enabled
→ 失败：Automatic alerts need setup + Fix setup
```

### 11.2 技术方向

Forms-first trigger：

```javascript
ScriptApp.newTrigger('onFormSubmit')
  .forForm(FormApp.getActiveForm())
  .onFormSubmit()
  .create();
```

要求：

1. 防止重复创建 trigger。
2. Fix setup 可以重新创建 trigger。
3. trigger 失败时写本地 debug log。
4. Test deployment 阶段可先重点测试 Sidebar 和 Send Test；真实 trigger 后续用内部发布或更接近真实的环境测试。

---

## 12. onFormSubmit 流程

```text
onFormSubmit(e)
→ e.response.getItemResponses()
→ 构建 responseMap
→ 读取 enabled notifications
→ 执行 RuleEngine
→ fail: update lastStatus skipped/error
→ pass: render message/payload
→ SlackService.send()
→ update lastStatus sent/error
→ append debug log
```

responseMap 结构：

```json
{
  "123456789": {
    "fieldId": "123456789",
    "title": "Budget",
    "value": "150"
  }
}
```

---

## 13. Test with Latest Response

```text
用户点击 Send Test
→ form.getResponses()
→ 读取最新一条 response
→ 构建 responseMap
→ 执行当前 filter
→ 匹配则真实发送 Slack
→ 不匹配则 skipped
→ 更新 lastStatus/debugLogs
```

要求：

1. Test 不计入 Free credits。
2. 无 response 时提示先提交一条测试表单。
3. Test 必须使用真实 Slack Webhook。

---

## 14. 本地状态与 debug log

插件端不展示完整 Log 页面。

只保留：

1. Last status
2. Copy debug info
3. 本地最近 10 条 debug log

lastStatus 示例：

```json
{
  "status": "sent",
  "time": "2026-06-09T12:00:00Z",
  "message": "Slack message sent"
}
```

debug log 示例：

```json
{
  "time": "2026-06-09T12:00:00Z",
  "level": "error",
  "code": "INVALID_PAYLOAD",
  "message": "Payload JSON is invalid",
  "notificationId": "notif_xxx"
}
```

限制：

1. 本地最多保留 10 条。
2. 不上传服务器。
3. Copy debug info 由用户主动复制。
4. 不在 UI 展示完整日志列表。

---

## 15. 数据结构

```json
{
  "installationId": "inst_xxx",
  "licenseCode": "FA-XXXX-XXXX-XXXX",
  "cachedPlan": "free",
  "notifications": [],
  "lastStatus": {},
  "debugLogs": [],
  "freeCreditsUsed": 5,
  "triggerInstalled": true
}
```

Notification：

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
        "fieldId": "123456789",
        "fieldTitle": "Budget",
        "fieldType": "number",
        "operator": "gt",
        "value": "100"
      }
    ]
  }
}
```

---

## 16. 技术模块

建议文件：

```text
Code.gs
Sidebar.html
appsscript.json
ConfigService.gs
FieldService.gs
RuleEngine.gs
SlackService.gs
PayloadService.gs
DebugService.gs
TriggerService.gs
LicenseService.gs
```

模块职责：

| 模块 | 职责 |
|---|---|
| FieldService | 读取 Form questions、最新 response、构建 responseMap |
| RuleEngine | 执行 number/text filter |
| MessageRenderer | 渲染 Message |
| PayloadService | 校验和渲染 Payload |
| SlackService | 发送 Slack Webhook |
| TriggerService | ensureFormSubmitTrigger / Fix setup |
| DebugService | lastStatus + 最近 10 条 debug log |
| LicenseService | Mock plan |

---

## 17. 验收标准

- [ ] 插件出现在 Google Forms 右上角插件按钮中。
- [ ] Sidebar 可从 Google Forms 页面打开。
- [ ] 可读取当前 Form questions。
- [ ] Field Refresh 可更新问题字段。
- [ ] Webhook 可保存到 PropertiesService。
- [ ] Message Mode 可测试发送。
- [ ] Payload Mode 可测试发送。
- [ ] Payload JSON 无效时提示错误。
- [ ] 数值 `= / ≠ / > / < / >= / <=` 可判断。
- [ ] 字符串 `contains / equals` 可判断。
- [ ] Budget > 100 时 sent。
- [ ] Budget <= 100 时 skipped。
- [ ] Test with Latest Response 可用。
- [ ] 保存第一条 notification 后自动 ensureFormSubmitTrigger。
- [ ] Trigger 失败时显示 Fix setup。
- [ ] 真实表单提交可触发 onFormSubmit。
- [ ] lastStatus 正确更新。
- [ ] Copy debug info 可用。
- [ ] debugLogs 最多保留 10 条。
- [ ] 不上传 response 内容。
- [ ] 不上传 Slack Webhook。
- [ ] 不使用 Drive / Gmail 权限。
