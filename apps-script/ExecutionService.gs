var ExecutionService = {
  run: function (notification, responseMap, options) {
    options = options || {};
    var isTest = options.isTest === true;
    var releaseReservedCredit = false;
    if (options.skipFilter !== true) {
      try {
        LicenseService.assertCanExecute(notification);
      } catch (error) {
        DebugService.write('error', notification, { reasonCode: 'PLAN_LIMIT' });
        return { ok: false, status: 'error', message: error.message };
      }
    }
    var ruleResult = options.skipFilter === true
      ? { matched: true, status: 'matched', reason: 'Filter skipped for quick test.' }
      : RuleEngine.evaluate(notification.filter, responseMap);

    if (ruleResult.error) {
      DebugService.write('error', notification, { reasonCode: this.reasonCodeForError(ruleResult.reason) });
      return { ok: false, status: 'error', message: ruleResult.reason };
    }
    if (!ruleResult.matched) {
      DebugService.write('skipped', notification, { reasonCode: 'RULE_NOT_MATCHED' });
      return { ok: true, status: 'skipped', message: 'Latest response did not match this filter.' };
    }

    try {
      var payload = this.render(notification, responseMap);
      if (!isTest) releaseReservedCredit = LicenseService.reserveSendCredit();
      var slackResult = SlackService.send(notification.webhookUrl, payload);
      if (!slackResult.ok) {
        if (releaseReservedCredit) {
          LicenseService.releaseSendCredit();
          releaseReservedCredit = false;
        }
        DebugService.write('error', notification, {
          reasonCode: 'SLACK_ERROR',
          slackResponseCode: slackResult.responseCode
        });
        return { ok: false, status: 'error', message: slackResult.error };
      }
      releaseReservedCredit = false;
      DebugService.write(isTest ? 'test' : 'sent', notification, {
        reasonCode: isTest ? 'TEST_SENT' : 'SLACK_SENT',
        slackResponseCode: slackResult.responseCode
      });
      return { ok: true, status: isTest ? 'test' : 'sent', message: isTest ? 'Test sent to Slack.' : 'Notification sent to Slack.' };
    } catch (error) {
      if (releaseReservedCredit) LicenseService.releaseSendCredit();
      DebugService.write('error', notification, { reasonCode: 'EXECUTION_ERROR' });
      return { ok: false, status: 'error', message: error.message };
    }
  },

  reasonCodeForError: function (message) {
    var text = String(message || '').toLowerCase();
    if (text.indexOf('requires a number') !== -1) return 'NUMBER_PARSE_ERROR';
    if (text.indexOf('enter a value') !== -1) return 'FILTER_VALUE_REQUIRED';
    if (text.indexOf('field no longer exists') !== -1) return 'FIELD_NOT_FOUND';
    return 'RULE_ERROR';
  },

  render: function (notification, responseMap) {
    if (notification.messageType === 'payload') {
      return PayloadService.render(notification.payloadTemplate, responseMap);
    }
    return { text: MessageRenderer.render(notification.messageTemplate, responseMap) };
  },

  runAll: function (responseMap, formId) {
    var notification = NotificationService.getByFormId(formId || FieldService.getFormId());
    if (!notification || !NotificationService.isEntitled(notification.id)) return [];
    if (notification.enabled === false) {
      DebugService.write('paused', notification, { reasonCode: 'PAUSED' });
      return [{ ok: true, status: 'paused', message: 'Form alert is paused.' }];
    }
    return [ExecutionService.run(notification, responseMap, { isTest: false })];
  }
};
