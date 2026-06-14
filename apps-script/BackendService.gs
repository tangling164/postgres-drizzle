var BackendService = {
  getIdentityToken: function () {
    ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
    var identityToken = ScriptApp.getIdentityToken();
    if (!identityToken) {
      throw new Error('Google authorization is required. Reopen FormAlert and approve the requested permissions.');
    }
    return identityToken;
  },

  getIdentityAudience: function (identityToken) {
    try {
      var payload = String(identityToken || '').split('.')[1];
      if (!payload) return null;
      var decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString();
      var audience = JSON.parse(decoded).aud;
      return Array.isArray(audience) ? audience.join(',') : String(audience || '');
    } catch (error) {
      return null;
    }
  },

  request: function (path, options) {
    options = options || {};
    var identityToken = this.getIdentityToken();

    var requestOptions = {
      method: options.method || 'get',
      headers: {
        Authorization: 'Bearer ' + identityToken
      },
      muteHttpExceptions: true,
      followRedirects: false
    };
    if (options.payload !== undefined) {
      requestOptions.contentType = 'application/json';
      requestOptions.payload = JSON.stringify(options.payload);
    }

    var response;
    try {
      response = UrlFetchApp.fetch(ConfigService.getBackendApiUrl() + path, requestOptions);
    } catch (error) {
      throw new Error('FormAlert could not reach the license service. Try again in a moment.');
    }

    var status = response.getResponseCode();
    var text = response.getContentText();
    var body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (error) {
        if (status >= 200 && status < 300) {
          throw new Error('The license service returned an invalid response. Try again in a moment.');
        }
      }
    }

    if (status >= 200 && status < 300) return body;
    throw new Error(this.errorMessage(body && body.error, status, identityToken));
  },

  activateLicense: function (licenseCode) {
    var normalized = String(licenseCode || '').trim().toUpperCase();
    var officialPattern = /^FA-[SB]-(?:[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-){3}[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
    if (!officialPattern.test(normalized)) {
      throw new Error('License code is invalid. Use the code from your purchase email.');
    }
    return this.request('/v2/license/activate', {
      method: 'post',
      payload: { code: normalized }
    });
  },

  getPlan: function () {
    return this.request('/v2/account/plan');
  },

  errorMessage: function (errorCode, status, identityToken) {
    var messages = {
      unauthorized: 'Google authorization was rejected. Identity audience: ' + (this.getIdentityAudience(identityToken) || 'unavailable') + '.',
      license_not_found: 'License code is invalid. Check the code in your purchase email.',
      license_already_used: 'This license code is already active on another Google account.',
      license_revoked: 'This license code is no longer active. Contact support if you need help.',
      license_expired: 'This license code has expired. Purchase a new plan to continue.',
      lower_tier_license_not_allowed: 'Your current plan is higher than this license. Use the matching or higher-tier license.',
      rate_limited: 'Too many activation attempts. Wait a few minutes and try again.'
    };
    return messages[errorCode] || (status >= 500
      ? 'The license service is temporarily unavailable. Try again in a moment.'
      : 'The license request could not be completed. Check the code and try again.');
  }
};
