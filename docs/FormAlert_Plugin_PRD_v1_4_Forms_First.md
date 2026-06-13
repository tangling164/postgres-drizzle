# FormAlert for Slack 插件端 PRD v1.4 — Google Forms First

版本：v1.4  
范围：Google Forms Editor Add-on 插件端  
主入口：Google Forms 页面右上角插件按钮  
参考竞品：SlackNotify 插件端 UI 与 Google Forms 插件入口  
本次更新重点：修正 v1.3 UI 体验问题，明确 filter/condition 概念，优化 Payload、debug、flash message、notification 列表与测试逻辑。

---

## 0. v1.4 更新摘要

相对 v1.3，本版本做以下关键调整：

1. 插件 UI 只保留一个标题栏，避免 Google Sidebar 原生标题栏 + 自定义标题栏重复。
2. 主界面不直接展示 Status 模块，底部仅保留 `debug()` 链接。
3. 点击 `debug()` 后弹出 Debug 面板，显示 lastStatus，并支持 Copy debug info。
4. 插件本地最多保留最近 10 条 debug log。
5. 插件端不展示完整日志列表。
6. 统一使用顶部 flash message 作为提示机制，提示不长期占据界面。
7. Filter 不再强制使用；无 filter 时默认所有新回复都发送。
8. Message / Payload 中即使不使用 `{{}}` 变量，也可以直接 Send Test 到 Slack。
9. Send Test 可用于快速验证 Webhook 和模板，不应被 filter 阻止。
10. `Run on new form responses` 选项删除，改为 notification 的 `Enabled / Disabled`。
11. Filter 独立成单独页面。
12. 术语调整：Filter = 过滤器模块；Condition = 一条过滤条件。
13. Condition 计数规则：每新增一行 condition，计数 +1，不按字段类型或 operator 合并。
14. 多 condition 时才显示 Match；单 condition 不显示 Match。
15. Match 只作用于当前 notification 下所有 enabled conditions。
16. Notification 列表不显示 `Budget > 100` 这类过滤器摘要。
17. Payload 模式下才显示 `Get Payload` 按钮；Message 模式不显示。
18. `Get Payload` 打开 Slack Block Kit Builder 模板页。
19. 删除解释性语言，例如 “Use {{Question title}} variables from the current Google Form.”
20. Google Sheets 不作为第一版主入口。

---

## 1. 产品定位

### 1.1 一句话定位

**Filtered Slack alerts for Google Forms. Send Slack notifications only when form responses match your rules.**

中文理解：

**给 Google Forms 的 Slack 通知加一层可选过滤器。用户可以像 SlackNotify 一样发送全部表单回复，也可以只发送符合条件的回复。**

### 1.2 核心差异

```text
SlackNotify:
Google Form response → Slack

FormAlert:
Google Form response → optional filter → Slack
```

### 1.3 插件端核心目标

用户在 Google Forms 编辑页点击右上角插件按钮，打开 FormAlert Sidebar，完成：

1. 配置 Slack Webhook URL。
2. 配置 Message 或 Payload 模板。
3. 可选配置过滤器。
4. 发送测试消息。
5. 保存 notification。
6. 新表单回复提交时自动判断并发送 Slack。

---

## 2. 产品边界

### 2.1 第一版必须做

1. Google Forms Editor Add-on 入口。
2. 在 Google Forms 页面打开 Sidebar。
3. 从当前 Google Form 读取问题字段。
4. 保存 Slack Webhook URL。
5. Message Mode。
6. Payload Mode。
7. Payload Mode 下显示 Get Payload 按钮。
8. Filter 独立页面。
9. Condition 支持数值和字符串判断。
10. Send Test。
11. Test latest response。
12. 保存第一条 notification 后自动安装 form submit trigger。
13. 真实表单提交后自动发送或 skipped。
14. Notification 列表搜索与分页。
15. 首页最近 3 条 notification。
16. 顶部 flash message。
17. 底部 `debug()` 链接。
18. Copy debug info。
19. 本地最近 10 条 debug log。
20. Mock License：FREE / STANDARD-TEST / BUSINESS-TEST。

### 2.2 第一版不做

1. Google Sheets 作为主入口。
2. Web Dashboard。
3. Creem。
4. 真实 License API。
5. AI Rule Builder。
6. 管道符过滤语法，例如 `value|value>100`。
7. Slack OAuth。
8. 服务器端日志。
9. 云端保存表单内容。
10. 云端保存 Slack Webhook。
11. 插件端完整 Log 页面。
12. Gmail / Drive 权限。
13. 复杂 AND / OR 嵌套条件。
14. Filter group。
15. 选择部分 condition 加入 any。
16. 自建 Slack Block Kit 可视化编辑器。

---

## 3. 插件入口

### 3.1 主入口

插件必须作为 **Google Forms Editor Add-on** 工作。

用户路径：

```text
Google Forms 编辑页
→ 右上角插件按钮
→ FormAlert for Slack
→ 打开 Sidebar
```

### 3.2 Google Sheets 不作为 v1.4 主路径

旧路径不作为本阶段主入口：

```text
Google Form
→ Response Sheet
→ Google Sheets 插件 Sidebar
```

v1.4 主路径：

```text
Google Form
→ Google Forms 插件 Sidebar
```

---

## 4. UI 总原则

1. 插件界面只保留一个标题栏。
2. 优先使用 Google Sidebar 原生标题栏。
3. HTML 内部不再重复显示 `FORMALERT FOR SLACK` 大标题栏。
4. 不长期展示解释性文字。
5. 提示信息使用顶部 flash message。
6. Debug 信息隐藏在底部 `debug()` 链接中。
7. 主界面聚焦：notification 管理、webhook、message/payload、filter、test、save。
8. Notification 列表不显示复杂过滤器摘要。
9. Payload 相关高级入口只在 Payload 模式下出现。
10. Filter 是可选增强能力，不是强制流程。

---

## 5. Flash Message 机制

### 5.1 位置

所有提示消息显示在 Sidebar 内容区域顶部。

```text
+--------------------------------------+
| Saved successfully                   |
+--------------------------------------+
| Notification Name                    |
| [ High value lead alert            ] |
|                                      |
| Webhook URL                          |
| [ https://hooks.slack.com/services ] |
+--------------------------------------+
```

错误示例：

```text
+--------------------------------------+
| Payload JSON is invalid              |
+--------------------------------------+
| Payload                              |
| [ { "text": "..."                  ] |
+--------------------------------------+
```

### 5.2 行为规则

| 类型 | 示例 | 展示时间 |
|---|---|---|
| success | Saved successfully | 3 秒自动消失 |
| info | Test message sent | 3 秒自动消失 |
| warning | Latest response skipped | 5 秒自动消失 |
| error | Payload JSON is invalid | 8 秒自动消失，或用户手动关闭 |

### 5.3 使用场景

Flash message 用于：

1. Saved。
2. Test sent。
3. Test skipped。
4. Payload invalid。
5. Webhook missing。
6. Field missing。
7. Filter error。
8. Trigger setup failed。
9. Debug info copied。

不允许把提示消息长期嵌入主表单区域。

---

## 6. Main / Dashboard 页面

### 6.1 页面目标

首页只承担 4 个任务：

1. 显示当前账号、plan、credits。
2. 展示最近 3 条 notification。
3. 提供搜索入口和完整列表入口。
4. 提供 `debug()` 链接。

不展示：

1. Last sent time。
2. Last skipped time。
3. `Budget > 100` 过滤器摘要。
4. 完整 logs。
5. Status 大模块。
6. `Run on new form responses`。

### 6.2 ASCII 布局

```text
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
| Enabled                  [Edit][Del] |
|--------------------------------------|
| Support Request                      |
| Enabled                  [Edit][Del] |
|--------------------------------------|
| Course Signup                        |
| Disabled                 [Edit][Del] |
|--------------------------------------|
| [ + Add Notification ]               |
| [ View all notifications ]           |
|                                      |
|                              debug() |
+--------------------------------------+
```

### 6.3 交互说明

| 操作 | 结果 |
|---|---|
| Search | 搜索 notification name / form title |
| Add Notification | 进入 Create Notification |
| View all notifications | 进入 All Notifications |
| Edit | 进入 Edit Notification |
| Delete | 二次确认后删除 |
| debug() | 打开 Debug 弹窗 |
| Upgrade | 打开 Pricing 页面 |

---

## 7. All Notifications 页面

Business 最多支持 100 个 notification，因此完整列表必须支持搜索和分页。

### 7.1 ASCII 布局

```text
+--------------------------------------+
| All Notifications               Back |
+--------------------------------------+
| [ Search...                      ]   |
|                                      |
| Chinese101 Feedback Form             |
| Enabled                  [Edit][Del] |
|--------------------------------------|
| Support Request                      |
| Enabled                  [Edit][Del] |
|--------------------------------------|
| Course Signup                        |
| Disabled                 [Edit][Del] |
|--------------------------------------|
| Page 1 / 10        [Prev] [Next]     |
+--------------------------------------+
```

### 7.2 规则

1. 每页 10 条 notification。
2. 首页只显示最近 3 条。
3. 搜索采用本地字符串 contains。
4. 搜索范围：notification name、form title。
5. 不搜索 filter condition。
6. 不显示过滤器摘要。
7. 不显示 last sent time。

---

## 8. Create / Edit Notification 页面

### 8.1 页面目标

用户完成一条 Slack notification 的配置：

1. Notification name。
2. Enabled / Disabled。
3. Webhook URL。
4. Message 或 Payload。
5. Insert field。
6. Send Test。
7. Test latest response。
8. 可选 filters。
9. Save。

### 8.2 ASCII 布局

```text
+--------------------------------------+
| Create Notification            [Back]|
+--------------------------------------+
| Notification Name                    |
| [ High value lead alert            ] |
|                                      |
| Status                               |
| [ Enabled v ]                        |
|                                      |
| Webhook Url                          |
| [ https://hooks.slack.com/services ] |
|                                      |
| Message Type                         |
| [ Message ] [ Payload ]              |
|                                      |
| < Message or Payload Area >          |
|                                      |
| Add Form Field                       |
| [ Budget                         v ] |
| [ Insert Field ] [Refresh Fields]    |
|                                      |
| Test                                 |
| [Send Test] [Test latest response]   |
|                                      |
| Filters                              |
| Optional                             |
| 2 conditions configured              |
| [Edit filters]                       |
|                                      |
| [Save]                              |
+--------------------------------------+
```

### 8.3 删除项

不再显示：

```text
Run on new form responses
```

用以下字段替代：

```text
Status: Enabled / Disabled
```

解释：

1. Enabled = 新表单回复会运行这条 notification。
2. Disabled = 保存配置但不自动运行。
3. 默认 Enabled。
4. 用户不需要理解 trigger。

---

## 9. Message / Payload 交互

### 9.1 Message Type

```text
Message Type
[ Message ] [ Payload ]
```

### 9.2 Message 模式

当 `messageType = message`：

```text
+--------------------------------------+
| Message                              |
| [ New form response                ] |
| [ Name: {{Name}}                   ] |
| [ Budget: {{Budget}}               ] |
|                                      |
| Add Form Field                       |
| [ Budget                         v ] |
| [ Insert Field ] [Refresh Fields]    |
+--------------------------------------+
```

Message 模式不显示 `Get Payload`。

### 9.3 Payload 模式

当 `messageType = payload`：

```text
+--------------------------------------+
| Payload                  [Get Payload]|
| [                                  ] |
| [ {                                ] |
| [   "text": "New response {{Name}}" ] |
| [ }                                ] |
| [                                  ] |
|                                      |
| Add Form Field                       |
| [ Budget                         v ] |
| [ Insert Field ] [Refresh Fields]    |
+--------------------------------------+
```

### 9.4 Get Payload 规则

1. `Get Payload` 只在 Payload 模式显示。
2. Message 模式不显示。
3. 点击后在新标签页打开：

```text
https://app.slack.com/block-kit-builder/T0B9SHVRGG0/templates
```

4. 插件不内置 Block Kit 编辑器。
5. 用户从 Slack Block Kit Builder 复制 JSON payload 到插件。
6. 切换 Message / Payload 时保留各自模板内容。

---

## 10. Send Test 与 Test latest response

### 10.1 为什么需要拆分

用户有两类测试需求：

1. 快速验证 Slack Webhook 和模板是否能发送。
2. 验证真实表单回复、变量替换和 filter 是否工作。

因此 v1.4 提供两个按钮：

```text
[Send Test] [Test latest response]
```

### 10.2 Send Test

用途：

```text
快速测试 Slack Webhook 和当前 Message/Payload 内容。
```

规则：

1. 不执行 filter。
2. 不要求配置 filter。
3. 如果模板没有 `{{}}`，直接发送静态内容。
4. 如果模板包含 `{{}}`，尝试使用 latest response 替换变量。
5. 如果没有 latest response 且模板包含变量，提示错误。
6. Send Test 不计入 Free credits。
7. Send Test 成功后显示顶部 flash message：`Test message sent`。

示例：

Message template：

```text
Hello from FormAlert
```

点击 `Send Test`：

```text
直接发送到 Slack
不执行 filter
不需要表单 response
```

### 10.3 Test latest response

用途：

```text
测试真实表单数据 + 变量替换 + filter。
```

规则：

1. 读取当前 Google Form 最新一条 response。
2. 构建 responseMap。
3. 如果没有 filter：直接发送。
4. 如果有 filter：执行 RuleEngine。
5. 匹配：渲染 Message/Payload 并发送 Slack。
6. 不匹配：不发送，显示 flash message：`Latest response skipped`。
7. Test latest response 不计入 Free credits。

---

## 11. 字段来源

### 11.1 字段读取

字段来自当前 Google Form 的问题列表，不来自 response Sheet 表头。

技术方向：

```javascript
const form = FormApp.getActiveForm();
const items = form.getItems();
```

### 11.2 内部字段标识

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

### 11.3 变量插入

用户点击 Insert Field：

```text
Budget → {{Budget}}
```

内部执行时优先用 fieldId 解析，显示和模板中仍使用 fieldTitle。

### 11.4 不支持字段类型

MVP 可先不支持或降级为 text：

1. File upload。
2. Grid。
3. Date / Time 先作为 text。
4. Checkbox 多选转为逗号分隔文本。

---

## 12. Filter / Condition 概念

### 12.1 术语

v1.4 中统一使用：

```text
Filter = 过滤器模块
Condition = 一条过滤条件
```

结构：

```text
Filter
  ├─ Condition 1: Budget > 100
  ├─ Condition 2: Priority equals High
  └─ Condition 3: Message contains refund
```

### 12.2 Filter 可选

1. 用户可以不配置 filter。
2. 无 filter 时，所有新表单回复都会发送 Slack。
3. 有 filter 时，只有满足条件才发送。
4. Message/Payload 与 Filter 解耦。
5. Filter 不写在 Message/Payload 里。
6. 不支持管道符语法。

---

## 13. Filters 页面

### 13.1 Create/Edit 页面中的入口

Create/Edit 页面不直接展示所有 conditions，只显示摘要和入口：

```text
Filters
Optional
2 conditions configured
[Edit filters]
```

无 filter 时：

```text
Filters
Optional
No filters
[Edit filters]
```

### 13.2 Filters 页面布局

```text
+--------------------------------------+
| Filters                         Back |
+--------------------------------------+
| [ + Add condition ]                  |
|                                      |
| Budget        >          100         |
|                         [Edit][Del] |
|--------------------------------------|
| Priority      equals     High        |
|                         [Edit][Del] |
|--------------------------------------|
| Message       contains   refund      |
|                         [Edit][Del] |
|--------------------------------------|
| Match: all                           |
| Page 1 / 2          [Prev] [Next]    |
+--------------------------------------+
```

### 13.3 分页规则

1. 每页最多显示 5 条 conditions。
2. 超过 5 条显示分页。
3. Free 最多 1 条 condition。
4. Standard 最多 5 条 conditions。
5. Business 最多 10 条 conditions。
6. 每新增一行 condition，计数 +1。
7. 不按字段类型、operator 或 value 合并计数。

示例：

```text
Budget > 100
Age > 18
Score > 80
```

虽然都是 number + `>`，但计数为：

```text
3 conditions
```

---

## 14. Add / Edit Condition 页面

```text
+--------------------------------------+
| Add Condition                   Back |
+--------------------------------------+
| Field                                |
| [ Budget                         v ] |
|                                      |
| Operator                             |
| [ >                              v ] |
|                                      |
| Value                                |
| [ 100                              ] |
|                                      |
| [Save Condition]                     |
+--------------------------------------+
```

---

## 15. Match: all / any

### 15.1 显示规则

1. 单条 condition 时不显示 Match。
2. 多条 condition 时显示 Match。
3. Match 只显示两个选项：`all`、`any`。
4. Match 作用于当前 notification 下所有 enabled conditions。
5. 不支持选择部分 conditions 参与 any。
6. 不支持嵌套条件。

### 15.2 all 的含义

`all` = 所有 conditions 都满足才发送 Slack。

例子：

```text
Budget > 100
Priority equals High
Match: all
```

逻辑：

```text
Budget > 100 AND Priority equals High
```

| Budget | Priority | 结果 |
|---:|---|---|
| 150 | High | sent |
| 150 | Low | skipped |
| 50 | High | skipped |
| 50 | Low | skipped |

### 15.3 any 的含义

`any` = 任意一个 condition 满足就发送 Slack。

例子：

```text
Budget > 100
Priority equals High
Match: any
```

逻辑：

```text
Budget > 100 OR Priority equals High
```

| Budget | Priority | 结果 |
|---:|---|---|
| 150 | High | sent |
| 150 | Low | sent |
| 50 | High | sent |
| 50 | Low | skipped |

### 15.4 MVP 不支持的复杂规则

不支持：

```text
Budget > 100 AND (Priority equals High OR Message contains refund)
```

这种需求后续可以通过 Filter Groups 扩展，v1.4 不做。

---

## 16. 数值与字符串操作符

### 16.1 数值操作符

UI：

```text
=
≠
>
<
>=
<=
```

内部 operator：

| UI | 内部值 |
|---|---|
| = | eq |
| ≠ | neq |
| > | gt |
| < | lt |
| >= | gte |
| <= | lte |

规则：

1. 字段值和目标值必须可转为数字。
2. 自动去除 `$`、`,`、空格。
3. 非数字返回 error。
4. 空值按 error 处理。

### 16.2 字符串操作符

UI：

```text
contains
equals
```

内部 operator：

| UI | 内部值 |
|---|---|
| contains | contains |
| equals | text_eq |

规则：

1. 默认大小写不敏感。
2. 自动 trim。
3. contains 不使用正则。
4. 空字符串不匹配。

---

## 17. Trigger 设计

### 17.1 用户不感知 trigger

不在主界面展示：

```text
Install Form Submit Trigger
Run on new form responses
```

用户保存第一条 notification 后自动处理：

```text
saveNotification()
→ ensureFormSubmitTrigger()
→ 成功：flash message "Automatic alerts enabled"
→ 失败：flash message "Automatic alerts need setup"
```

如果失败，在必要位置显示：

```text
[Fix setup]
```

但不要解释 trigger 概念。

### 17.2 技术方向

Forms-first trigger：

```javascript
ScriptApp.newTrigger('onFormSubmit')
  .forForm(FormApp.getActiveForm())
  .onFormSubmit()
  .create();
```

要求：

1. 防止重复创建 trigger。
2. Fix setup 可重新创建 trigger。
3. trigger 失败写本地 debug log。
4. Test Deployment 阶段重点测试 Sidebar 和 Send Test。
5. 真实 trigger 后续用更接近真实发布的环境验证。

---

## 18. onFormSubmit 流程

```text
onFormSubmit(e)
→ e.response.getItemResponses()
→ 构建 responseMap
→ 读取 enabled notifications
→ notification disabled: skip
→ no filter: send
→ has filter: RuleEngine.evaluate()
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

## 19. Debug 设计

### 19.1 主界面

主界面底部只显示：

```text
debug()
```

### 19.2 Debug 弹窗

```text
+--------------------------------------+
| Debug                           Close|
+--------------------------------------+
| Last status: sent                    |
| Last run: 2026-06-10 12:30           |
| Last error: none                     |
|                                      |
| [Copy debug info]                    |
+--------------------------------------+
```

### 19.3 本地 debug log

只保存在本地 `PropertiesService`。

最多保留 10 条。

示例：

```json
{
  "time": "2026-06-10T12:00:00Z",
  "level": "error",
  "code": "INVALID_PAYLOAD",
  "message": "Payload JSON is invalid",
  "notificationId": "notif_xxx"
}
```

限制：

1. 不上传服务器。
2. 不在主界面展示完整列表。
3. 用户主动点击 Copy debug info 时复制。
4. debug log 不应包含 Slack Webhook。
5. debug log 不应包含完整表单回复内容。
6. debug log 不应包含完整替换后的 payload。

---

## 20. 数据结构

### 20.1 本地配置

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

### 20.2 Notification

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
        "id": "cond_xxx",
        "enabled": true,
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

### 20.3 lastStatus

```json
{
  "status": "sent",
  "time": "2026-06-10T12:00:00Z",
  "message": "Slack message sent",
  "notificationId": "notif_xxx"
}
```

---

## 21. 技术模块

建议文件：

```text
Code.gs
Sidebar.html
appsscript.json
ConfigService.gs
FieldService.gs
NotificationService.gs
RuleEngine.gs
MessageRenderer.gs
PayloadService.gs
SlackService.gs
DebugService.gs
TriggerService.gs
LicenseService.gs
```

| 模块 | 职责 |
|---|---|
| FieldService | 读取 Form questions、最新 response、构建 responseMap |
| NotificationService | notification CRUD、搜索、分页、enabled 状态 |
| RuleEngine | 执行 condition 和 match 逻辑 |
| MessageRenderer | 渲染 Message |
| PayloadService | 校验和渲染 Payload |
| SlackService | 发送 Slack Webhook |
| TriggerService | ensureFormSubmitTrigger / Fix setup |
| DebugService | lastStatus + 最近 10 条 debug log |
| LicenseService | Mock plan 和限制 |

---

## 22. License Mock 限制

| Plan | Notifications | Credits | Conditions |
|---|---:|---:|---:|
| FREE | 1 | 30 | 1 |
| STANDARD-TEST | 10 | unlimited | 5 |
| BUSINESS-TEST | 100 | unlimited | 10 |

说明：

1. 条件数量按 condition row 计算。
2. 不按字段类型合并。
3. Send Test 和 Test latest response 不计入 credits。
4. 真实 license API 后续实现。

---

## 23. 错误处理

所有错误使用顶部 flash message + debug log。

| 错误 | Flash message | Debug code |
|---|---|---|
| Webhook 为空 | Webhook URL is missing | WEBHOOK_MISSING |
| Webhook 无效 | Invalid Slack Webhook URL | WEBHOOK_INVALID |
| Slack 返回失败 | Slack returned an error | SLACK_ERROR |
| Payload JSON 无效 | Payload JSON is invalid | INVALID_PAYLOAD |
| 缺少变量字段 | Field not found | FIELD_NOT_FOUND |
| 没有最新 response | No form response found | NO_RESPONSE |
| 数值转换失败 | Number filter requires a number | NUMBER_PARSE_ERROR |
| Filter value 为空 | Filter value is required | FILTER_VALUE_REQUIRED |
| Trigger 创建失败 | Automatic alerts need setup | TRIGGER_SETUP_FAILED |
| Free limit reached | Free limit reached | FREE_LIMIT_REACHED |

---

## 24. 验收标准

### 24.1 UI 验收

- [ ] 插件出现在 Google Forms 右上角插件按钮中。
- [ ] Sidebar 可从 Google Forms 页面打开。
- [ ] 只显示一个标题栏。
- [ ] 顶部 flash message 可显示并自动消失。
- [ ] Main 页面显示最近 3 条 notification。
- [ ] Notification 列表不显示过滤器摘要。
- [ ] All Notifications 支持搜索和分页。
- [ ] `debug()` 在底部显示。
- [ ] 点击 `debug()` 可弹出 Debug 面板。
- [ ] Create/Edit 页面没有 `Run on new form responses`。
- [ ] Payload 模式才显示 `Get Payload`。
- [ ] Message 模式不显示 `Get Payload`。
- [ ] Filters 独立页面可打开。
- [ ] 超过 5 条 conditions 可分页显示。
- [ ] 单 condition 不显示 Match。
- [ ] 多 condition 显示 Match。

### 24.2 功能验收

- [ ] 可读取当前 Form questions。
- [ ] Field Refresh 可更新问题字段。
- [ ] Webhook 可保存到 PropertiesService。
- [ ] Message Mode 可 Send Test。
- [ ] 静态 Message 不含 `{{}}` 时可直接 Send Test。
- [ ] Payload Mode 可 Send Test。
- [ ] Payload JSON 无效时提示错误。
- [ ] Get Payload 打开 Slack Block Kit Builder URL。
- [ ] 数值 `= / ≠ / > / < / >= / <=` 可判断。
- [ ] 字符串 `contains / equals` 可判断。
- [ ] 无 filter 时 Test latest response 直接发送。
- [ ] 有 filter 且匹配时 sent。
- [ ] 有 filter 且不匹配时 skipped。
- [ ] all 逻辑正确。
- [ ] any 逻辑正确。
- [ ] 保存第一条 notification 后自动 ensureFormSubmitTrigger。
- [ ] Trigger 失败时出现 Fix setup。
- [ ] 真实表单提交可触发 onFormSubmit。
- [ ] lastStatus 正确更新。
- [ ] Copy debug info 可用。
- [ ] debugLogs 最多保留 10 条。

### 24.3 安全边界验收

- [ ] 不上传 Google Form response 内容。
- [ ] 不上传 Slack Webhook。
- [ ] 不上传完整 Message。
- [ ] 不上传完整 Payload。
- [ ] 不使用 Drive 权限。
- [ ] 不使用 Gmail 权限。
- [ ] 不使用 AI。
- [ ] 服务器端日志不在本阶段实现。

---

## 25. 开发优先级

### Milestone 1：UI 清理与 Forms-first 基础

1. 单标题栏。
2. Forms 插件入口。
3. Main 页面。
4. All Notifications 页面。
5. Flash message。
6. debug() 弹窗。

### Milestone 2：Notification 配置

1. Create/Edit。
2. Enabled / Disabled。
3. Webhook 保存。
4. Message Mode。
5. Payload Mode。
6. Get Payload 条件显示。
7. Field Refresh / Insert Field。

### Milestone 3：测试逻辑

1. Send Test。
2. Test latest response。
3. 静态消息直接发送。
4. latest response 变量替换。
5. Payload JSON 校验。

### Milestone 4：Filter / Condition

1. Filters 独立页面。
2. Condition CRUD。
3. Condition 分页。
4. all / any。
5. RuleEngine。
6. Plan condition 限制。

### Milestone 5：Trigger 与真实提交

1. ensureFormSubmitTrigger。
2. Fix setup。
3. onFormSubmit。
4. lastStatus。
5. debugLogs。

---

## 26. 最终开发原则

FormAlert 插件端 v1.4 的核心原则：

```text
先让用户把 Slack 消息发出去，再让用户选择是否加过滤。
```

产品形态：

```text
Message/Payload first
Filter optional
Condition-based
Flash message on top
Debug hidden
No persistent logs
No filter summary in notification list
Payload advanced entry only in Payload mode
```

核心链路：

```text
Google Form response
→ optional filter conditions
→ render Message/Payload
→ Slack Webhook
```

禁止把产品做成复杂自动化规则引擎。第一版只解决一个明确问题：

```text
Google Forms 提交后，按条件筛选是否发送 Slack 通知。
```
