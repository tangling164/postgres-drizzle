var SlackService = {
  validateWebhook: function (webhookUrl) {
    var value = String(webhookUrl || '').trim();
    if (!value) throw new Error('Please enter a Slack Webhook URL.');
    if (!/^https:\/\/hooks\.slack\.com\/services\/[^/\s]+\/[^/\s]+\/[^/\s]+$/.test(value)) {
      throw new Error('This does not look like a valid Slack Webhook URL.');
    }
    return value;
  },

  send: function (webhookUrl, payload) {
    var url = this.validateWebhook(webhookUrl);
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: false
    });
    var responseCode = response.getResponseCode();
    if (responseCode < 200 || responseCode >= 300) {
      return { ok: false, responseCode: responseCode, error: 'Slack returned an error. Please check your webhook.' };
    }
    return { ok: true, responseCode: responseCode };
  }
};
