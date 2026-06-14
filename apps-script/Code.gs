function onOpen(event) {
  FormApp.getUi()
    .createAddonMenu()
    .addItem('Open FormAlert', 'showSidebar')
    .addToUi();
}

function onInstall(event) {
  onOpen(event);
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('FormAlert for Slack')
    .setWidth(360);
  FormApp.getUi().showSidebar(html);
}

function onFormSubmit(event) {
  try {
    var formId = event && event.source ? FieldService.getFormId(event.source) : FieldService.getFormId();
    return ExecutionService.runAll(FieldService.fromSubmitEvent(event), formId);
  } catch (error) {
    DebugService.write('error', null, { reasonCode: 'SUBMIT_EVENT_ERROR' });
    throw error;
  }
}

function getSidebarBootstrap() {
  var migrationWarning = NotificationService.migrateCurrentFormLegacy();
  var usage;
  var planSyncWarning = null;
  var identityDiagnostics = null;
  try {
    usage = LicenseService.refreshUsage();
  } catch (error) {
    usage = LicenseService.getUsage();
    planSyncWarning = error.message;
    identityDiagnostics = BackendService.getIdentityDiagnostics();
  }
  var notifications = NotificationService.getPage('', 1, 3);
  var email = Session.getActiveUser().getEmail();
  return {
    appVersion: FormAlertConfig.APP_VERSION,
    userEmail: email || 'Current Google account',
    usage: usage,
    planSyncWarning: planSyncWarning,
    identityDiagnostics: identityDiagnostics,
    notifications: notifications.items,
    formCount: NotificationService.getAllRaw().length,
    currentFormId: FieldService.getFormId(),
    currentFormConnected: NotificationService.getCurrentFormConfig() !== null,
    migrationWarning: migrationWarning,
    triggerStatus: TriggerService.getStatus()
  };
}

function getNotificationsPage(search, page) {
  return NotificationService.getPage(search, page, 10);
}

function getEditorData(notificationId) {
  NotificationService.migrateCurrentFormLegacy();
  var fields = FieldService.getFields();
  var notification = NotificationService.getCurrentFormConfig();
  if (notificationId && (!notification || notification.id !== notificationId)) {
    throw new Error('Open the target Google Form to edit this alert.');
  }
  var formTitle = FieldService.getFormTitle();
  return {
    fields: fields,
    usage: LicenseService.getUsage(),
    notification: notification || {
      id: null,
      name: formTitle,
      enabled: true,
      webhookUrl: '',
      messageType: 'message',
      messageTemplate: 'New form response\n\n' + (fields[0] ? fields[0].fieldTitle + ': {{' + fields[0].fieldTitle + '}}' : ''),
      payloadTemplate: '{\n  "text": "New form response",\n  "blocks": []\n}',
      filter: {
        match: 'all',
        conditions: []
      }
    }
  };
}

function refreshFields() {
  return FieldService.getFields();
}

function saveNotificationApi(notification) {
  return NotificationService.save(notification);
}

function deleteNotificationApi(notificationId) {
  return NotificationService.remove(notificationId);
}

function setNotificationEnabledApi(notificationId, enabled) {
  return NotificationService.setEnabled(notificationId, enabled);
}

function validatePayloadApi(payloadTemplate) {
  var fields = FieldService.getFields().map(function (field) { return field.fieldTitle; });
  return PayloadService.validate(payloadTemplate, fields);
}

function sendTestApi(notification) {
  LicenseService.authorizeTest();
  var normalized = prepareTestNotification_(notification, true);
  var template = normalized.messageType === 'payload' ? normalized.payloadTemplate : normalized.messageTemplate;
  var responseMap = MessageRenderer.extractVariables(template).length ? FieldService.getLatestResponse() : {};
  return ExecutionService.run(normalized, responseMap, { isTest: true, skipFilter: true });
}

function testLatestResponseApi(notification) {
  LicenseService.authorizeTest();
  var normalized = prepareTestNotification_(notification, true);
  return ExecutionService.run(normalized, FieldService.getLatestResponse(), { isTest: true });
}

function testNotificationApi(notification) {
  return testLatestResponseApi(notification);
}

function prepareTestNotification_(notification, enforcePlan) {
  var existing = NotificationService.getCurrentFormConfig();
  if (notification.id && (!existing || existing.id !== notification.id)) throw new Error('This Form alert does not belong to the current Google Form.');
  if (enforcePlan) {
    LicenseService.assertCanSave({ id: existing ? existing.id : null, messageType: notification.messageType, filter: notification.filter }, NotificationService.getAllRaw());
  }
  if (existing && !NotificationService.isEntitled(existing.id)) {
    throw new Error('This notification is outside the current plan limit. Upgrade or delete another notification to test it.');
  }
  return NotificationService.validateAndNormalize(notification, existing);
}

function fixSetupApi() {
  return TriggerService.ensureFormSubmitTrigger();
}

function activateLicenseApi(licenseCode) {
  return LicenseService.activate(licenseCode);
}

function copyDebugInfoApi() {
  try {
    LicenseService.refreshUsage();
  } catch (error) {}
  return JSON.stringify(DebugService.getDebugInfo(), null, 2);
}

function getDebugPanelApi() {
  return DebugService.getPanelData();
}

function defaultCondition_(fields) {
  var field = fields[0] || { fieldId: '', fieldTitle: '', fieldType: 'text' };
  return {
    id: 'cond_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20),
    enabled: true,
    fieldId: field.fieldId,
    fieldTitle: field.fieldTitle,
    fieldType: field.fieldType,
    operator: field.fieldType === 'number' ? 'gt' : 'contains',
    value: ''
  };
}
