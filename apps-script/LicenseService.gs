var LicenseService = {
  PLAN_LIMITS: {
    free: { plan: 'free', label: 'Free', maxForms: 1, maxNotifications: 1, maxConditions: 1, credits: 30 },
    standard: { plan: 'standard', label: 'Standard', maxForms: 10, maxNotifications: 10, maxConditions: 5, credits: null },
    business: { plan: 'business', label: 'Business', maxForms: 20, maxNotifications: 20, maxConditions: 10, credits: null }
  },

  getPlan: function () {
    var properties = ConfigService.userProperties();
    var plan = properties.getProperty(FormAlertConfig.KEYS.PLAN) || 'free';
    return this.PLAN_LIMITS[plan] || this.PLAN_LIMITS.free;
  },

  activate: function (licenseCode) {
    var normalized = String(licenseCode || '').trim().toUpperCase();
    var plan = normalized === 'FREE' ? 'free' : normalized === 'STANDARD-TEST' ? 'standard' : normalized === 'BUSINESS-TEST' ? 'business' : null;
    if (!plan) {
      throw new Error('License code is invalid or expired.');
    }
    var properties = ConfigService.userProperties();
    if (plan === 'free') properties.deleteProperty(FormAlertConfig.KEYS.LICENSE_CODE);
    else properties.setProperty(FormAlertConfig.KEYS.LICENSE_CODE, normalized);
    properties.setProperty(FormAlertConfig.KEYS.PLAN, plan);
    return this.getUsage();
  },

  resetToFree: function () {
    var properties = ConfigService.userProperties();
    properties.deleteProperty(FormAlertConfig.KEYS.LICENSE_CODE);
    properties.setProperty(FormAlertConfig.KEYS.PLAN, 'free');
    return this.getUsage();
  },

  getUsedCredits: function () {
    var used = Number(ConfigService.documentProperties().getProperty(FormAlertConfig.KEYS.FREE_CREDITS_USED) || 0);
    return isFinite(used) && used > 0 ? Math.floor(used) : 0;
  },

  getUsage: function () {
    var plan = this.getPlan();
    var used = this.getUsedCredits();
    return {
      plan: plan.plan,
      label: plan.label,
      maxForms: plan.maxForms,
      maxNotifications: plan.maxNotifications,
      maxConditions: plan.maxConditions,
      creditsTotal: plan.credits,
      creditsUsed: plan.credits === null ? 0 : used,
      creditsLeft: plan.credits === null ? null : Math.max(0, plan.credits - used)
    };
  },

  assertCanSave: function (notification, existingNotifications) {
    var plan = this.getPlan();
    var isNew = !notification.id;
    if (isNew && existingNotifications.length >= plan.maxForms) {
      throw new Error(plan.label + ' supports up to ' + plan.maxForms + ' connected Google Form' + (plan.maxForms === 1 ? '' : 's') + '. Delete an existing Form alert before connecting this Form.');
    }
    var conditions = notification.filter && notification.filter.conditions ? notification.filter.conditions : [];
    if (conditions.length > plan.maxConditions) {
      throw new Error(plan.label + ' allows up to ' + plan.maxConditions + ' filter condition' + (plan.maxConditions === 1 ? '.' : 's.'));
    }
  },

  assertCanExecute: function (notification) {
    var plan = this.getPlan();
    var conditions = notification && notification.filter && notification.filter.conditions ? notification.filter.conditions : [];
    if (conditions.length > plan.maxConditions) {
      throw new Error(plan.label + ' allows up to ' + plan.maxConditions + ' filter condition' + (plan.maxConditions === 1 ? '.' : 's.') + ' Edit this notification to continue.');
    }
  },

  assertCanSend: function () {
    var usage = this.getUsage();
    if (usage.creditsLeft !== null && usage.creditsLeft <= 0) {
      throw new Error('Free limit reached. Upgrade to continue sending alerts.');
    }
  },

  reserveSendCredit: function () {
    if (this.getPlan().plan !== 'free') return false;
    return ConfigService.withDocumentLock(function () {
      var properties = ConfigService.documentProperties();
      var used = LicenseService.getUsedCredits();
      if (used >= LicenseService.PLAN_LIMITS.free.credits) {
        throw new Error('Free limit reached. Upgrade to continue sending alerts.');
      }
      properties.setProperty(FormAlertConfig.KEYS.FREE_CREDITS_USED, String(used + 1));
      return true;
    });
  },

  releaseSendCredit: function () {
    return ConfigService.withDocumentLock(function () {
      var properties = ConfigService.documentProperties();
      var used = LicenseService.getUsedCredits();
      properties.setProperty(FormAlertConfig.KEYS.FREE_CREDITS_USED, String(Math.max(0, used - 1)));
    });
  },

  recordSend: function () {
    return this.reserveSendCredit();
  }
};
