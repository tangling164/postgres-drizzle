var NotificationService = {
  configKey: function (formId) {
    return FormAlertConfig.KEYS.FORM_CONFIG_PREFIX + String(formId || '');
  },

  getIndex: function () {
    var index = ConfigService.readJson(ConfigService.userProperties(), FormAlertConfig.KEYS.FORM_INDEX, []);
    if (!Array.isArray(index)) return [];
    var seen = {};
    return index.filter(function (entry) {
      var formId = String(entry && entry.formId || '');
      if (!formId || seen[formId]) return false;
      seen[formId] = true;
      return true;
    });
  },

  writeIndex: function (index) {
    return ConfigService.writeJson(ConfigService.userProperties(), FormAlertConfig.KEYS.FORM_INDEX, index);
  },

  readFormConfig: function (formId) {
    if (!formId) return null;
    var notification = ConfigService.readJson(ConfigService.userProperties(), this.configKey(formId), null);
    return notification && notification.formId === formId ? notification : null;
  },

  writeFormConfig: function (notification) {
    ConfigService.writeJson(ConfigService.userProperties(), this.configKey(notification.formId), notification);
    var index = this.getIndex().filter(function (entry) { return entry.formId !== notification.formId; });
    index.push(this.toIndexItem(notification));
    index.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    this.writeIndex(index);
    return notification;
  },

  toIndexItem: function (notification) {
    return {
      formId: notification.formId,
      formTitle: notification.formTitle,
      notificationId: notification.id,
      enabled: notification.enabled !== false,
      updatedAt: notification.updatedAt
    };
  },

  migrateCurrentFormLegacy: function () {
    return ConfigService.withUserLock(function () {
      var formId = FieldService.getFormId();
      if (NotificationService.readFormConfig(formId)) return null;
      var documentProperties = ConfigService.documentProperties();
      if (documentProperties.getProperty(FormAlertConfig.KEYS.LEGACY_MIGRATED) === 'true') return null;
      var legacy = ConfigService.readJson(documentProperties, FormAlertConfig.KEYS.NOTIFICATIONS, []);
      if (!Array.isArray(legacy) || !legacy.length) return null;
      var latest = legacy.slice().sort(function (a, b) {
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      })[0];
      latest.formId = formId;
      latest.formTitle = FieldService.getFormTitle();
      latest.name = latest.formTitle;
      latest.updatedAt = latest.updatedAt || new Date().toISOString();
      NotificationService.writeFormConfig(latest);
      documentProperties.setProperty(FormAlertConfig.KEYS.LEGACY_MIGRATED, 'true');
      return legacy.length > 1
        ? 'This Form previously had multiple alerts. The most recently updated alert was migrated; the legacy alerts remain available for rollback.'
        : 'This Form alert was migrated to the connected Forms dashboard.';
    });
  },

  getAll: function () {
    return this.getAllRaw();
  },

  getAllRaw: function () {
    return this.getIndex().map(function (entry) {
      return NotificationService.readFormConfig(entry.formId);
    }).filter(function (notification) { return notification !== null; });
  },

  getEntitled: function () {
    var limit = LicenseService.getPlan().maxForms;
    return this.getAllRaw()
      .slice()
      .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); })
      .slice(0, limit);
  },

  isEntitled: function (id) {
    return this.getEntitled().some(function (notification) { return notification.id === id; });
  },

  getEnabled: function () {
    return this.getEntitled().filter(function (notification) { return notification.enabled !== false; });
  },

  getById: function (id) {
    return this.getAllRaw().filter(function (notification) { return notification.id === id; })[0] || null;
  },

  getByFormId: function (formId) {
    return this.readFormConfig(String(formId || ''));
  },

  getCurrentFormConfig: function () {
    return this.getByFormId(FieldService.getFormId());
  },

  getPage: function (search, page, pageSize) {
    var term = String(search || '').trim().toLowerCase();
    var size = pageSize || 10;
    var currentFormId = FieldService.getFormId();
    var entitledIds = this.getEntitled().map(function (notification) { return notification.id; });
    var maxConditions = LicenseService.getPlan().maxConditions;
    var all = this.getAllRaw().slice().sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    var filtered = term ? all.filter(function (notification) {
      return String(notification.formTitle || '').toLowerCase().indexOf(term) !== -1;
    }) : all;
    var totalPages = Math.max(1, Math.ceil(filtered.length / size));
    var currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    return {
      items: filtered.slice((currentPage - 1) * size, currentPage * size).map(function (notification) {
        var conditions = notification.filter && notification.filter.conditions ? notification.filter.conditions : [];
        return NotificationService.toListItem(
          notification,
          entitledIds.indexOf(notification.id) !== -1 && conditions.length <= maxConditions,
          currentFormId
        );
      }),
      page: currentPage,
      pageSize: size,
      total: filtered.length,
      totalPages: totalPages
    };
  },

  toListItem: function (notification, entitled, currentFormId) {
    return {
      id: notification.id,
      formId: notification.formId,
      formTitle: notification.formTitle || 'Untitled form',
      enabled: notification.enabled !== false,
      entitled: entitled !== false,
      isCurrentForm: notification.formId === currentFormId
    };
  },

  save: function (input) {
    var result = ConfigService.withUserLock(function () {
      var currentFormId = FieldService.getFormId();
      var existing = NotificationService.getByFormId(currentFormId);
      if (input.id && (!existing || existing.id !== input.id)) {
        throw new Error('This Form alert does not belong to the current Google Form.');
      }
      LicenseService.assertCanSave({ id: existing ? existing.id : null, filter: input.filter }, NotificationService.getAllRaw());
      var normalized = NotificationService.validateAndNormalize(input, existing);
      NotificationService.writeFormConfig(normalized);
      return normalized;
    });
    return {
      notification: result,
      triggerStatus: TriggerService.ensureFormSubmitTrigger()
    };
  },

  setEnabled: function (id, enabled) {
    return ConfigService.withUserLock(function () {
      var notification = NotificationService.getById(id);
      if (!notification) throw new Error('Form alert not found.');
      notification.enabled = enabled === true;
      notification.updatedAt = new Date().toISOString();
      NotificationService.writeFormConfig(notification);
      return NotificationService.toListItem(notification, NotificationService.isEntitled(id), FieldService.getFormId());
    });
  },

  validateAndNormalize: function (input, existing) {
    var fields = FieldService.getFields();
    var fieldTitles = fields.map(function (field) { return field.fieldTitle; });
    var formTitle = FieldService.getFormTitle();
    SlackService.validateWebhook(input.webhookUrl);
    var messageType = input.messageType === 'payload' ? 'payload' : 'message';
    if (messageType === 'message' && !String(input.messageTemplate || '').trim()) {
      throw new Error('Message template cannot be empty.');
    }
    if (messageType === 'payload') {
      var payloadValidation = PayloadService.validate(input.payloadTemplate, fieldTitles);
      if (!payloadValidation.valid) throw new Error(payloadValidation.error);
      if (payloadValidation.missingVariables.length) {
        throw new Error('This variable does not match any form field: ' + payloadValidation.missingVariables.join(', '));
      }
    }
    var conditions = input.filter && Array.isArray(input.filter.conditions) ? input.filter.conditions : [];
    var normalizedConditions = conditions.map(function (condition) {
      var requestedId = String(condition.fieldId || '').trim();
      var requestedTitle = String(condition.fieldTitle || condition.field || '').trim();
      var field = fields.filter(function (candidate) {
        return requestedId ? candidate.fieldId === requestedId : candidate.fieldTitle === requestedTitle;
      })[0];
      if (!field) throw new Error('This field no longer exists in your form. Refresh fields.');
      var normalized = {
        id: String(condition.id || '').trim() || 'cond_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20),
        enabled: true,
        fieldId: field.fieldId,
        fieldTitle: field.fieldTitle,
        fieldType: condition.fieldType === 'number' ? 'number' : 'text',
        operator: String(condition.operator || ''),
        value: String(condition.value == null ? '' : condition.value)
      };
      var validationMap = {};
      validationMap[field.fieldId] = {
        fieldId: field.fieldId,
        title: field.fieldTitle,
        value: normalized.fieldType === 'number' ? normalized.value : 'validation'
      };
      RuleEngine.evaluateCondition(normalized, validationMap);
      return normalized;
    });
    var now = new Date().toISOString();
    return {
      id: existing ? existing.id : 'notif_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20),
      name: formTitle,
      formId: FieldService.getFormId(),
      formTitle: formTitle,
      enabled: existing ? existing.enabled !== false : true,
      webhookUrl: String(input.webhookUrl).trim(),
      messageType: messageType,
      messageTemplate: String(input.messageTemplate || ''),
      payloadTemplate: String(input.payloadTemplate || ''),
      filter: {
        match: normalizedConditions.length > 1 && input.filter && input.filter.match === 'any' ? 'any' : 'all',
        conditions: normalizedConditions
      },
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
  },

  remove: function (id) {
    var removed = ConfigService.withUserLock(function () {
      var notification = NotificationService.getById(id);
      if (!notification) throw new Error('Form alert not found.');
      ConfigService.userProperties().deleteProperty(NotificationService.configKey(notification.formId));
      NotificationService.writeIndex(NotificationService.getIndex().filter(function (entry) {
        return entry.formId !== notification.formId;
      }));
      return notification;
    });
    TriggerService.removeFormSubmitTrigger(removed.formId);
    return { ok: true, formId: removed.formId };
  }
};
