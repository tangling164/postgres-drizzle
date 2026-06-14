const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const port = Number(process.argv[2] || 4179)
const sidebarPath = path.resolve(__dirname, '..', 'Sidebar.html')
const sidebar = fs.readFileSync(sidebarPath, 'utf8')

const mockScript = `
<script>
  const previewFields = [
    { fieldId: '11', fieldTitle: 'Budget', fieldType: 'number' },
    { fieldId: '12', fieldTitle: 'Message', fieldType: 'text' },
    { fieldId: '13', fieldTitle: 'Priority', fieldType: 'text' }
  ];
  const previewNotifications = [
    { id: 'notif-1', formId: 'form-1', formTitle: 'Chinese101 Feedback Form', enabled: true, entitled: true, isCurrentForm: true },
    { id: 'notif-2', formId: 'form-2', formTitle: 'Support Request Form', enabled: true, entitled: true, isCurrentForm: false },
    { id: 'notif-3', formId: 'form-3', formTitle: 'Course Signup Form', enabled: false, entitled: true, isCurrentForm: false }
  ];
  const previewEditor = {
    id: null, name: '', enabled: true, webhookUrl: '', messageType: 'message',
    messageTemplate: 'New filtered form response\\\\n\\\\nBudget: {{Budget}}',
    payloadTemplate: '{\\\\n  "text": "New filtered response {{Budget}}",\\\\n  "blocks": []\\\\n}',
    filter: { match: 'all', conditions: [] }
  };
  const handlers = {
    getSidebarBootstrap: () => ({
      appVersion: '1.7.0-license-activation',
      userEmail: 'user@example.com',
      usage: { plan: 'business', label: 'Business', maxForms: 100, maxNotifications: 100, maxConditions: 50, allowsPayload: true, creditsTotal: null, creditsUsed: 0, creditsLeft: null },
      notifications: previewNotifications,
      formCount: 3,
      currentFormId: 'form-1',
      currentFormConnected: true,
      migrationWarning: null,
      triggerStatus: { installed: true, state: 'enabled', message: 'Automatic alerts: Enabled', error: null }
    }),
    getNotificationsPage: () => ({ items: previewNotifications, page: 1, pageSize: 10, total: 3, totalPages: 1 }),
    getEditorData: id => {
      const notification = JSON.parse(JSON.stringify(previewEditor));
      if (id) {
        notification.id = id;
        notification.name = 'High value lead';
        notification.webhookUrl = 'https://hooks.slack.com/services/T000/B000/preview';
        notification.filter.conditions.push(
          { id: 'cond-1', enabled: true, fieldId: '11', fieldTitle: 'Budget', fieldType: 'number', operator: 'gt', value: '100' },
          { id: 'cond-2', enabled: true, fieldId: '13', fieldTitle: 'Priority', fieldType: 'text', operator: 'text_eq', value: 'High' }
        );
      }
      return { fields: previewFields, usage: { plan: 'standard', label: 'Standard', maxForms: 20, maxNotifications: 20, maxConditions: 50, allowsPayload: true }, notification };
    },
    refreshFields: () => previewFields,
    validatePayloadApi: () => ({ valid: true, variables: ['Budget'], missingVariables: [] }),
    saveNotificationApi: () => ({ notification: previewEditor, triggerStatus: { state: 'enabled' } }),
    sendTestApi: () => ({ ok: true, status: 'test', message: 'Test sent to Slack.' }),
    testLatestResponseApi: () => ({ ok: true, status: 'skipped', message: 'Latest response did not match this filter.' }),
    deleteNotificationApi: () => ({ ok: true }),
    setNotificationEnabledApi: () => ({ enabled: false }),
    fixSetupApi: () => ({ installed: true, state: 'enabled' }),
    activateLicenseApi: () => ({ label: 'Standard' }),
    getDebugPanelApi: () => ({
      lastStatus: 'test',
      lastRun: '2026-06-10T08:00:00.000Z',
      lastError: null,
      recentDebugLogs: [
        { timestamp: '2026-06-10T08:00:00.000Z', status: 'test', reasonCode: 'TEST_SENT' },
        { timestamp: '2026-06-10T07:00:00.000Z', status: 'paused', reasonCode: 'PAUSED' }
      ]
    }),
    copyDebugInfoApi: () => '{"appVersion":"1.7.0-license-activation"}'
  };
  function runner(success, failure) {
    return new Proxy({}, {
      get(_, key) {
        if (key === 'withSuccessHandler') return callback => runner(callback, failure);
        if (key === 'withFailureHandler') return callback => runner(success, callback);
        return (...args) => {
          try { setTimeout(() => success && success(handlers[key] ? handlers[key](...args) : null), 0); }
          catch (error) { failure && failure(error); }
        };
      }
    });
  }
  window.google = { script: { run: runner(), host: { close() {} } } };
</script>`

const html = sidebar.replace('<script>', `${mockScript}<script>`)

http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(html)
}).listen(port, '127.0.0.1', () => {
  console.log(`Sidebar preview: http://127.0.0.1:${port}`)
})
