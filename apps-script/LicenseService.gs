var LicenseService = {
  PLAN_LIMITS: {
    none: { plan: 'none', label: 'Trial ended', maxForms: 0, maxNotifications: 0, maxConditions: 0, allowsPayload: false, credits: 0 },
    free: { plan: 'free', label: 'Free', maxForms: 1, maxNotifications: 1, maxConditions: 0, allowsPayload: false, credits: 30 },
    standard: { plan: 'standard', label: 'Standard', maxForms: 20, maxNotifications: 20, maxConditions: 50, allowsPayload: true, credits: null },
    business: { plan: 'business', label: 'Business', maxForms: 100, maxNotifications: 100, maxConditions: 50, allowsPayload: true, credits: null }
  },

  getPlan: function () {
    var properties = ConfigService.userProperties();
    this.retireLegacyLocalLicense(properties);
    var plan = properties.getProperty(FormAlertConfig.KEYS.PLAN) || 'free';
    return this.PLAN_LIMITS[plan] || this.PLAN_LIMITS.free;
  },

  retireLegacyLocalLicense: function (properties) {
    if (!properties.getProperty(FormAlertConfig.KEYS.LICENSE_CODE)) return false;
    properties.deleteProperty(FormAlertConfig.KEYS.LICENSE_CODE);
    properties.deleteProperty(FormAlertConfig.KEYS.BILLING_CYCLE);
    properties.deleteProperty(FormAlertConfig.KEYS.PLAN_EXPIRES_AT);
    properties.setProperty(FormAlertConfig.KEYS.PLAN, 'free');
    return true;
  },

  activate: function (licenseCode) {
    var result = BackendService.activateLicense(licenseCode);
    return this.applyRemotePlan(result);
  },

  refreshUsage: function () {
    return this.applyRemotePlan(BackendService.getPlan());
  },

  applyRemotePlan: function (result) {
    var remotePlan = result && result.plan;
    var plan = this.PLAN_LIMITS[remotePlan] ? remotePlan : 'none';
    var properties = ConfigService.userProperties();
    properties.setProperty(FormAlertConfig.KEYS.PLAN, plan);
    properties.deleteProperty(FormAlertConfig.KEYS.LICENSE_CODE);
    if ((plan === 'standard' || plan === 'business') && result && (result.billing_cycle === 'monthly' || result.billing_cycle === 'yearly')) {
      properties.setProperty(FormAlertConfig.KEYS.BILLING_CYCLE, result.billing_cycle);
    } else {
      properties.deleteProperty(FormAlertConfig.KEYS.BILLING_CYCLE);
    }
    if (result && result.valid_until) {
      properties.setProperty(FormAlertConfig.KEYS.PLAN_EXPIRES_AT, result.valid_until);
    } else {
      properties.deleteProperty(FormAlertConfig.KEYS.PLAN_EXPIRES_AT);
    }
    return this.getUsage();
  },

  getUsedCredits: function () {
    var used = Number(ConfigService.documentProperties().getProperty(FormAlertConfig.KEYS.FREE_CREDITS_USED) || 0);
    return isFinite(used) && used > 0 ? Math.floor(used) : 0;
  },

  getUsage: function () {
    var plan = this.getPlan();
    var used = this.getUsedCredits();
    var billingCycle = ConfigService.userProperties().getProperty(FormAlertConfig.KEYS.BILLING_CYCLE);
    var displayLabel = plan.label;
    if ((plan.plan === 'standard' || plan.plan === 'business') && (billingCycle === 'monthly' || billingCycle === 'yearly')) {
      displayLabel += ' / ' + billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1);
    }
    return {
      plan: plan.plan,
      label: plan.label,
      displayLabel: displayLabel,
      billingCycle: billingCycle,
      maxForms: plan.maxForms,
      maxNotifications: plan.maxNotifications,
      maxConditions: plan.maxConditions,
      allowsPayload: plan.allowsPayload,
      validUntil: ConfigService.userProperties().getProperty(FormAlertConfig.KEYS.PLAN_EXPIRES_AT),
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
    this.assertSupportsMessageType(notification.messageType);
  },

  assertCanExecute: function (notification) {
    var plan = this.getPlan();
    var conditions = notification && notification.filter && notification.filter.conditions ? notification.filter.conditions : [];
    if (conditions.length > plan.maxConditions) {
      throw new Error(plan.label + ' allows up to ' + plan.maxConditions + ' filter condition' + (plan.maxConditions === 1 ? '.' : 's.') + ' Edit this notification to continue.');
    }
    this.assertSupportsMessageType(notification && notification.messageType);
  },

  assertSupportsMessageType: function (messageType) {
    if (messageType === 'payload' && !this.getPlan().allowsPayload) {
      throw new Error('Payload Mode requires a paid plan.');
    }
  },

  assertCanSend: function () {
    var usage = this.getUsage();
    if (usage.creditsLeft !== null && usage.creditsLeft <= 0) {
      throw new Error('Free limit reached. Upgrade to continue sending alerts.');
    }
  },

  reserveSendCredit: function () {
    var plan = this.getPlan().plan;
    if (plan === 'none') {
      throw new Error('Your Free trial has ended. Upgrade to continue sending alerts.');
    }
    if (plan !== 'free') return false;
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
