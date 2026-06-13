var RuleEngine = {
  NUMBER_OPERATORS: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
  TEXT_OPERATORS: ['contains', 'text_eq'],

  evaluate: function (filter, responseMap) {
    try {
      var conditions = filter && Array.isArray(filter.conditions)
        ? filter.conditions.filter(function (condition) { return condition.enabled !== false; })
        : [];
      if (!conditions.length) {
        return { matched: true, status: 'matched', reason: 'No filter conditions.' };
      }

      var results = conditions.map(function (condition) {
        return RuleEngine.evaluateCondition(condition, responseMap);
      });
      var match = conditions.length > 1 && filter.match === 'any' ? 'any' : 'all';
      var matched = match === 'any'
        ? results.some(function (result) { return result.matched; })
        : results.every(function (result) { return result.matched; });

      return {
        matched: matched,
        status: matched ? 'matched' : 'skipped',
        reason: results.map(function (result) { return result.reason; }).join(match === 'any' ? ' OR ' : ' AND ')
      };
    } catch (error) {
      return { matched: false, status: 'error', error: true, reason: error.message };
    }
  },

  evaluateCondition: function (condition, responseMap) {
    if (!condition || (!condition.fieldId && !condition.field && !condition.fieldTitle)) throw new Error('Please select a field for this filter.');
    if (String(condition.value == null ? '' : condition.value).trim() === '') {
      throw new Error('Please enter a value for this filter.');
    }
    var response = this.findResponse(condition, responseMap);
    if (!response.found) throw new Error('This field no longer exists in your form. Refresh fields.');
    var field = condition.fieldTitle || condition.field || response.title || condition.fieldId;
    var actual = response.value;
    if (condition.fieldType === 'number') {
      return this.evaluateNumber(field, condition.operator, actual, condition.value);
    }
    return this.evaluateText(field, condition.operator, actual, condition.value);
  },

  findResponse: function (condition, responseMap) {
    var fieldId = String(condition.fieldId || '').trim();
    var fieldTitle = String(condition.fieldTitle || condition.field || '').trim();
    if (fieldId && Object.prototype.hasOwnProperty.call(responseMap, fieldId)) {
      return this.normalizeResponseEntry(responseMap[fieldId], fieldTitle);
    }
    if (fieldTitle && Object.prototype.hasOwnProperty.call(responseMap, fieldTitle)) {
      return this.normalizeResponseEntry(responseMap[fieldTitle], fieldTitle);
    }
    var keys = Object.keys(responseMap || {});
    for (var index = 0; index < keys.length; index += 1) {
      var entry = responseMap[keys[index]];
      if (entry && typeof entry === 'object' && String(entry.title || '') === fieldTitle) {
        return this.normalizeResponseEntry(entry, fieldTitle);
      }
    }
    return { found: false, title: fieldTitle, value: '' };
  },

  normalizeResponseEntry: function (entry, fallbackTitle) {
    if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'value')) {
      return { found: true, title: entry.title || fallbackTitle, value: entry.value };
    }
    return { found: true, title: fallbackTitle, value: entry };
  },

  parseNumber: function (value) {
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new Error('This filter requires a number.');
    }
    var normalized = String(value).replace(/[$,\s]/g, '');
    var number = Number(normalized);
    if (!isFinite(number)) throw new Error('This filter requires a number.');
    return number;
  },

  evaluateNumber: function (field, operator, actualValue, targetValue) {
    if (this.NUMBER_OPERATORS.indexOf(operator) === -1) throw new Error('Unsupported number operator.');
    var actual = this.parseNumber(actualValue);
    var target = this.parseNumber(targetValue);
    var matched = false;
    if (operator === 'eq') matched = actual === target;
    if (operator === 'neq') matched = actual !== target;
    if (operator === 'gt') matched = actual > target;
    if (operator === 'lt') matched = actual < target;
    if (operator === 'gte') matched = actual >= target;
    if (operator === 'lte') matched = actual <= target;
    return { matched: matched, reason: field + ' ' + operator + ' target' };
  },

  evaluateText: function (field, operator, actualValue, targetValue) {
    if (this.TEXT_OPERATORS.indexOf(operator) === -1) throw new Error('Unsupported text operator.');
    var actual = String(actualValue == null ? '' : actualValue).trim().toLowerCase();
    var target = String(targetValue == null ? '' : targetValue).trim().toLowerCase();
    var matched = actual !== '' && target !== '' && (operator === 'contains' ? actual.indexOf(target) !== -1 : actual === target);
    return { matched: matched, reason: field + ' ' + operator + ' target' };
  }
};
