var PayloadService = {
  validate: function (template, availableFields) {
    var text = String(template || '').trim();
    if (!text) return { valid: false, error: 'Payload JSON is invalid. Please check Block Kit payload.' };
    try {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'Payload must contain text or blocks.' };
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'text') && typeof parsed.text !== 'string') {
        return { valid: false, error: 'Payload text must be a string.' };
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'blocks') && !Array.isArray(parsed.blocks)) {
        return { valid: false, error: 'Payload blocks must be an array.' };
      }
      var hasText = typeof parsed.text === 'string' && parsed.text.trim() !== '';
      var hasBlocks = Array.isArray(parsed.blocks) && parsed.blocks.length > 0;
      if (!hasText && !hasBlocks) return { valid: false, error: 'Payload must contain text or blocks.' };
      var variables = MessageRenderer.extractVariables(text);
      var fields = Array.isArray(availableFields) ? availableFields : [];
      var missing = variables.filter(function (variable) { return fields.indexOf(variable) === -1; });
      return { valid: true, variables: variables, missingVariables: missing };
    } catch (error) {
      return { valid: false, error: 'Payload JSON is invalid. Please check Block Kit payload.' };
    }
  },

  render: function (template, responseMap) {
    var validation = this.validate(template, MessageRenderer.availableVariables(responseMap));
    if (!validation.valid) throw new Error(validation.error);
    if (validation.missingVariables.length) {
      throw new Error('This variable does not match any form field: ' + validation.missingVariables.join(', '));
    }
    var payload = JSON.parse(template);
    return this.renderValue(payload, responseMap);
  },

  renderValue: function (value, responseMap) {
    if (typeof value === 'string') return MessageRenderer.render(value, responseMap);
    if (Array.isArray(value)) return value.map(function (item) { return PayloadService.renderValue(item, responseMap); });
    if (value && typeof value === 'object') {
      var output = {};
      Object.keys(value).forEach(function (key) { output[key] = PayloadService.renderValue(value[key], responseMap); });
      return output;
    }
    return value;
  }
};
