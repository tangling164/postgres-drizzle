var FormAlertConfig = {
  APP_VERSION: '1.6.0-forms-first',
  MAX_PROPERTY_BYTES: 9000,
  KEYS: {
    INSTALLATION_ID: 'installationId',
    NOTIFICATIONS: 'notifications',
    LEGACY_MIGRATED: 'legacyNotificationsMigrated',
    FORM_INDEX: 'formIndex',
    FORM_CONFIG_PREFIX: 'formConfig.',
    DEBUG_LOGS: 'debugLogs',
    LAST_STATUS: 'lastStatus',
    FREE_CREDITS_USED: 'freeCreditsUsed',
    TRIGGER_ERROR: 'triggerError',
    LICENSE_CODE: 'licenseCode',
    PLAN: 'plan'
  }
};

var ConfigService = {
  documentProperties: function () {
    return PropertiesService.getDocumentProperties();
  },

  userProperties: function () {
    return PropertiesService.getUserProperties();
  },

  readJson: function (properties, key, fallback) {
    var value = properties.getProperty(key);
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  },

  writeJson: function (properties, key, value) {
    var serialized = JSON.stringify(value);
    if (this.utf8ByteLength(serialized) > FormAlertConfig.MAX_PROPERTY_BYTES) {
      throw new Error('This Form alert is too large to save. Shorten the Message or Payload template.');
    }
    properties.setProperty(key, serialized);
    return value;
  },

  utf8ByteLength: function (value) {
    var length = 0;
    for (var index = 0; index < String(value).length; index += 1) {
      var code = String(value).charCodeAt(index);
      if (code < 0x80) length += 1;
      else if (code < 0x800) length += 2;
      else if (code >= 0xD800 && code <= 0xDBFF) {
        length += 4;
        index += 1;
      } else length += 3;
    }
    return length;
  },

  getInstallationId: function () {
    var properties = this.documentProperties();
    var installationId = properties.getProperty(FormAlertConfig.KEYS.INSTALLATION_ID);
    if (!installationId) {
      installationId = 'inst_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
      properties.setProperty(FormAlertConfig.KEYS.INSTALLATION_ID, installationId);
    }
    return installationId;
  },

  withDocumentLock: function (callback) {
    var lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  },

  withUserLock: function (callback) {
    var lock = LockService.getUserLock();
    lock.waitLock(10000);
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  }
};
