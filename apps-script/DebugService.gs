var DebugService = {
  MAX_LOGS: 10,

  sanitizeEntry: function (entry) {
    entry = entry || {};
    var allowedStatuses = ['sent', 'skipped', 'error', 'test', 'paused'];
    var allowedReasonCodes = [
      'SUBMIT_EVENT_ERROR',
      'RULE_ERROR',
      'RULE_NOT_MATCHED',
      'SLACK_ERROR',
      'EXECUTION_ERROR',
      'TEST_SENT',
      'SLACK_SENT',
      'PLAN_LIMIT',
      'PLAN_SYNC_ERROR',
      'TRIGGER_SETUP_ERROR',
      'TRIGGER_SETUP_FAILED',
      'WEBHOOK_MISSING',
      'WEBHOOK_INVALID',
      'INVALID_PAYLOAD',
      'FIELD_NOT_FOUND',
      'NO_RESPONSE',
      'NUMBER_PARSE_ERROR',
      'FILTER_VALUE_REQUIRED',
      'FREE_LIMIT_REACHED',
      'PAUSED'
    ];
    var status = allowedStatuses.indexOf(entry.status) !== -1 ? entry.status : 'unknown';
    var reasonCode = allowedReasonCodes.indexOf(entry.reasonCode) !== -1 ? entry.reasonCode : 'UNKNOWN';
    var notificationId = /^notif_[A-Za-z0-9]+$/.test(String(entry.notificationId || '')) ? String(entry.notificationId) : null;
    var timestampValue = String(entry.timestamp || '');
    var timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestampValue) ? timestampValue : null;
    var responseCode = Number(entry.slackResponseCode);
    return {
      timestamp: timestamp,
      notificationId: notificationId,
      status: status,
      reasonCode: reasonCode,
      slackResponseCode: isFinite(responseCode) && responseCode > 0 ? responseCode : null
    };
  },

  write: function (status, notification, details) {
    var safeDetails = details || {};
    var entry = {
      timestamp: new Date().toISOString(),
      notificationId: notification && notification.id ? notification.id : null,
      status: status,
      reasonCode: safeDetails.reasonCode || null,
      slackResponseCode: safeDetails.slackResponseCode || null
    };
    return ConfigService.withDocumentLock(function () {
      var properties = ConfigService.documentProperties();
      var logs = ConfigService.readJson(properties, FormAlertConfig.KEYS.DEBUG_LOGS, []);
      if (!Array.isArray(logs)) logs = [];
      logs.unshift(entry);
      ConfigService.writeJson(properties, FormAlertConfig.KEYS.DEBUG_LOGS, logs.slice(0, DebugService.MAX_LOGS));
      ConfigService.writeJson(properties, FormAlertConfig.KEYS.LAST_STATUS, entry);
      return entry;
    });
  },

  getLogs: function () {
    var logs = ConfigService.readJson(ConfigService.documentProperties(), FormAlertConfig.KEYS.DEBUG_LOGS, []);
    return (Array.isArray(logs) ? logs : [])
      .slice(0, this.MAX_LOGS)
      .map(function (entry) { return DebugService.sanitizeEntry(entry); });
  },

  getLastStatus: function () {
    var entry = ConfigService.readJson(ConfigService.documentProperties(), FormAlertConfig.KEYS.LAST_STATUS, null);
    return entry ? this.sanitizeEntry(entry) : null;
  },

  getPanelData: function () {
    var logs = this.getLogs();
    var lastStatus = this.getLastStatus();
    var lastError = logs.filter(function (entry) { return entry.status === 'error'; })[0] || null;
    return {
      lastStatus: lastStatus ? lastStatus.status : 'No activity yet',
      lastRun: lastStatus ? lastStatus.timestamp : null,
      lastError: lastError ? lastError.reasonCode : null,
      recentDebugLogs: logs
    };
  },

  getDebugInfo: function () {
    var triggerStatus = TriggerService.getStatus();
    var usage = LicenseService.getUsage();
    return {
      capturedAt: new Date().toISOString(),
      appVersion: FormAlertConfig.APP_VERSION,
      installationId: ConfigService.getInstallationId(),
      plan: usage.plan,
      planSyncedAt: usage.planSyncedAt,
      lastStatus: this.getLastStatus(),
      recentDebugLogs: this.getLogs(),
      triggerStatus: {
        installed: triggerStatus.installed,
        state: triggerStatus.state,
        message: triggerStatus.message
      },
      formCount: NotificationService.getAllRaw().length,
      standardReadiness: TriggerService.getReadinessSummary()
    };
  }
};
