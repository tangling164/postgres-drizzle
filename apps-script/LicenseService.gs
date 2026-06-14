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
    if (plan === 'standard' || plan === 'business') {
      var paidExpiry = properties.getProperty(FormAlertConfig.KEYS.PLAN_EXPIRES_AT);
      if (!paidExpiry || this.isPast(paidExpiry)) return this.getCachedFreePlan(properties);
    }
    if (plan === 'free' && properties.getProperty(FormAlertConfig.KEYS.FREE_TRIAL_EXPIRES_AT)) {
      return this.getCachedFreePlan(properties);
    }
    return this.PLAN_LIMITS[plan] || this.PLAN_LIMITS.free;
  },

  isPast: function (value) {
    var timestamp = new Date(String(value || '')).getTime();
    return !isFinite(timestamp) || timestamp < new Date().getTime();
  },

  getCachedFreePlan: function (properties) {
    var expiresAt = properties.getProperty(FormAlertConfig.KEYS.FREE_TRIAL_EXPIRES_AT);
    var limit = Number(properties.getProperty(FormAlertConfig.KEYS.FREE_SEND_LIMIT) || this.PLAN_LIMITS.free.credits);
    var used = Number(properties.getProperty(FormAlertConfig.KEYS.FREE_SEND_USED) || 0);
    return expiresAt && !this.isPast(expiresAt) && isFinite(limit) && isFinite(used) && used < limit
      ? this.PLAN_LIMITS.free
      : this.PLAN_LIMITS.none;
  },

  retireLegacyLocalLicense: function (properties) {
    if (!properties.getProperty(FormAlertConfig.KEYS.LICENSE_CODE)) return false;
    properties.deleteProperty(FormAlertConfig.KEYS.LICENSE_CODE);
    properties.deleteProperty(FormAlertConfig.KEYS.BILLING_CYCLE);
    properties.deleteProperty(FormAlertConfig.KEYS.PLAN_EXPIRES_AT);
    properties.deleteProperty(FormAlertConfig.KEYS.PLAN_SYNCED_AT);
    properties.deleteProperty(FormAlertConfig.KEYS.FREE_TRIAL_EXPIRES_AT);
    properties.deleteProperty(FormAlertConfig.KEYS.FREE_SEND_LIMIT);
    properties.deleteProperty(FormAlertConfig.KEYS.FREE_SEND_USED);
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

  authorizeTest: function () {
    return this.applyRemotePlan(BackendService.authorizeTest());
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
    this.applyFreeTrialSnapshot(result && result.free_trial);
    properties.setProperty(FormAlertConfig.KEYS.PLAN_SYNCED_AT, new Date().toISOString());
    ConfigService.documentProperties().deleteProperty(FormAlertConfig.KEYS.FREE_CREDITS_USED);
    return this.getUsage();
  },

  applyFreeTrialSnapshot: function (trial) {
    var properties = ConfigService.userProperties();
    if (!trial) {
      properties.deleteProperty(FormAlertConfig.KEYS.FREE_TRIAL_EXPIRES_AT);
      properties.deleteProperty(FormAlertConfig.KEYS.FREE_SEND_LIMIT);
      properties.deleteProperty(FormAlertConfig.KEYS.FREE_SEND_USED);
      return;
    }
    properties.setProperty(FormAlertConfig.KEYS.FREE_TRIAL_EXPIRES_AT, String(trial.expires_at || ''));
    properties.setProperty(FormAlertConfig.KEYS.FREE_SEND_LIMIT, String(Number(trial.send_limit) || this.PLAN_LIMITS.free.credits));
    properties.setProperty(FormAlertConfig.KEYS.FREE_SEND_USED, String(Math.max(0, Number(trial.send_used) || 0)));
  },

  getUsedCredits: function () {
    var used = Number(ConfigService.userProperties().getProperty(FormAlertConfig.KEYS.FREE_SEND_USED) || 0);
    return isFinite(used) && used > 0 ? Math.floor(used) : 0;
  },

  getUsage: function () {
    var plan = this.getPlan();
    var used = this.getUsedCredits();
    var properties = ConfigService.userProperties();
    var billingCycle = properties.getProperty(FormAlertConfig.KEYS.BILLING_CYCLE);
    var trialExpiresAt = properties.getProperty(FormAlertConfig.KEYS.FREE_TRIAL_EXPIRES_AT);
    var freeLimit = Number(properties.getProperty(FormAlertConfig.KEYS.FREE_SEND_LIMIT) || this.PLAN_LIMITS.free.credits);
    if (!isFinite(freeLimit) || freeLimit < 0) freeLimit = this.PLAN_LIMITS.free.credits;
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
      validUntil: properties.getProperty(FormAlertConfig.KEYS.PLAN_EXPIRES_AT),
      planSyncedAt: properties.getProperty(FormAlertConfig.KEYS.PLAN_SYNCED_AT),
      trialExpiresAt: trialExpiresAt,
      creditsTotal: plan.credits === null || (plan.plan === 'none' && !trialExpiresAt) ? null : freeLimit,
      creditsUsed: plan.credits === null ? 0 : used,
      creditsLeft: plan.credits === null ? null : plan.plan === 'none' ? 0 : Math.max(0, freeLimit - used)
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
    if (usage.plan === 'none') {
      if (usage.creditsTotal !== null && usage.creditsUsed >= usage.creditsTotal) {
        throw new Error('Free limit reached. Upgrade to continue sending alerts.');
      }
      throw new Error('Your Free trial has ended. Upgrade to continue sending alerts.');
    }
    if (usage.creditsLeft !== null && usage.creditsLeft <= 0) {
      throw new Error('Free limit reached. Upgrade to continue sending alerts.');
    }
  },

  reserveSendCredit: function () {
    var result = BackendService.reserveSend();
    if (!result || result.reserved !== true) return false;
    this.applyFreeTrialSnapshot(result.free_trial);
    return result.reservation_id;
  },

  releaseSendCredit: function (reservationId) {
    if (!reservationId) return false;
    var result = BackendService.releaseSend(reservationId);
    if (result && result.released === true && result.send_used !== null) {
      ConfigService.userProperties().setProperty(FormAlertConfig.KEYS.FREE_SEND_USED, String(result.send_used));
      return true;
    }
    return false;
  },

  recordSend: function () {
    return this.reserveSendCredit();
  }
};
