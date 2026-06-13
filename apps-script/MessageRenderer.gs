var MessageRenderer = {
  VARIABLE_PATTERN: /\{\{([^{}]+)\}\}/g,

  extractVariables: function (template) {
    var variables = [];
    var match;
    var pattern = new RegExp(this.VARIABLE_PATTERN.source, 'g');
    while ((match = pattern.exec(String(template || ''))) !== null) {
      var name = match[1].trim();
      if (variables.indexOf(name) === -1) variables.push(name);
    }
    return variables;
  },

  missingVariables: function (template, responseMap) {
    return this.extractVariables(template).filter(function (field) {
      return !MessageRenderer.resolveVariable(field, responseMap).found;
    });
  },

  availableVariables: function (responseMap) {
    var variables = [];
    Object.keys(responseMap || {}).forEach(function (key) {
      var entry = responseMap[key];
      var title = entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.title : key;
      if (title && variables.indexOf(String(title)) === -1) variables.push(String(title));
    });
    return variables;
  },

  resolveVariable: function (field, responseMap) {
    if (Object.prototype.hasOwnProperty.call(responseMap, field)) {
      var direct = responseMap[field];
      return {
        found: true,
        value: direct && typeof direct === 'object' && Object.prototype.hasOwnProperty.call(direct, 'value') ? direct.value : direct
      };
    }
    var keys = Object.keys(responseMap || {});
    for (var index = 0; index < keys.length; index += 1) {
      var entry = responseMap[keys[index]];
      if (entry && typeof entry === 'object' && String(entry.title || '') === field) {
        return { found: true, value: entry.value };
      }
    }
    return { found: false, value: '' };
  },

  render: function (template, responseMap) {
    if (!String(template || '').trim()) throw new Error('Message template cannot be empty.');
    var missing = this.missingVariables(template, responseMap);
    if (missing.length) throw new Error('This variable does not match any form field: ' + missing.join(', '));
    return String(template).replace(this.VARIABLE_PATTERN, function (_, field) {
      var value = MessageRenderer.resolveVariable(String(field).trim(), responseMap).value;
      return value == null ? '' : String(value);
    });
  }
};
