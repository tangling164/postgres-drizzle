var TriggerService = {
  getFormSubmitTriggers: function (formId) {
    formId = formId || FieldService.getFormId();
    return ScriptApp.getProjectTriggers().filter(function (trigger) {
      if (trigger.getHandlerFunction() !== 'onFormSubmit') return false;
      if (typeof trigger.getEventType === 'function' && ScriptApp.EventType && trigger.getEventType() !== ScriptApp.EventType.ON_FORM_SUBMIT) return false;
      if (!formId || typeof trigger.getTriggerSourceId !== 'function') return true;
      return trigger.getTriggerSourceId() === formId;
    });
  },

  getStatus: function () {
    var triggers = this.getFormSubmitTriggers();
    var installed = triggers.length > 0;
    var duplicate = triggers.length > 1;
    var storedError = ConfigService.documentProperties().getProperty(FormAlertConfig.KEYS.TRIGGER_ERROR);
    var error = duplicate ? storedError || 'Multiple automatic alerts are installed.' : installed ? null : storedError;
    return {
      installed: installed,
      state: error ? 'needs_setup' : installed ? 'enabled' : 'disabled',
      message: error ? 'Automatic alerts need setup' : installed ? 'Automatic alerts: Enabled' : 'Automatic alerts are not enabled yet.',
      error: error || null
    };
  },

  cleanupOrphanedAndDuplicateTriggers: function () {
    var seen = {};
    var removed = 0;
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() !== 'onFormSubmit') return;
      if (typeof trigger.getEventType === 'function' && ScriptApp.EventType && trigger.getEventType() !== ScriptApp.EventType.ON_FORM_SUBMIT) return;
      var formId = typeof trigger.getTriggerSourceId === 'function' ? trigger.getTriggerSourceId() : null;
      var hasConfig = formId && NotificationService.getByFormId(formId);
      if (!hasConfig || seen[formId]) {
        ScriptApp.deleteTrigger(trigger);
        removed += 1;
        return;
      }
      seen[formId] = true;
    });
    return { ok: true, removed: removed };
  },

  ensureFormSubmitTrigger: function () {
    try {
      this.cleanupOrphanedAndDuplicateTriggers();
      if (!NotificationService.getCurrentFormConfig()) return this.getStatus();
      var triggers = this.getFormSubmitTriggers();
      if (!triggers.length) {
        ScriptApp.newTrigger('onFormSubmit').forForm(FieldService.getActiveForm()).onFormSubmit().create();
      } else if (triggers.length > 1) {
        triggers.slice(1).forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
      }
      ConfigService.documentProperties().deleteProperty(FormAlertConfig.KEYS.TRIGGER_ERROR);
      return this.getStatus();
    } catch (error) {
      ConfigService.documentProperties().setProperty(FormAlertConfig.KEYS.TRIGGER_ERROR, error.message);
      DebugService.write('error', null, { reasonCode: 'TRIGGER_SETUP_FAILED' });
      return this.getStatus();
    }
  },

  removeFormSubmitTrigger: function (formId) {
    var triggers = this.getFormSubmitTriggers(formId);
    triggers.forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
    return { ok: true, removed: triggers.length };
  }
};
