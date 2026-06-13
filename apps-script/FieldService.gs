var FieldService = {
  NON_RESPONSE_ITEM_TYPES: ['IMAGE', 'PAGE_BREAK', 'SECTION_HEADER', 'VIDEO'],

  getActiveForm: function () {
    var form = FormApp.getActiveForm();
    if (!form) throw new Error('No Google Form is open.');
    return form;
  },

  getFields: function (form) {
    form = form || this.getActiveForm();
    var fields = form.getItems()
      .filter(function (item) { return FieldService.isResponseItem(item); })
      .map(function (item) { return FieldService.toField(item); });
    if (!fields.length) throw new Error('No form questions found. Add a question to this Google Form.');
    return fields;
  },

  getFormTitle: function (form) {
    form = form || this.getActiveForm();
    return String(form.getTitle() || '').trim() || 'Untitled form';
  },

  getFormId: function (form) {
    form = form || this.getActiveForm();
    return String(form.getId() || '');
  },

  isResponseItem: function (item) {
    return this.NON_RESPONSE_ITEM_TYPES.indexOf(String(item.getType())) === -1;
  },

  toField: function (item) {
    var itemType = String(item.getType());
    var fieldType = itemType === 'SCALE' || itemType === 'RATING' ? 'number' : 'text';
    var fieldTitle = String(item.getTitle() || '').trim() || 'Untitled question';
    return {
      fieldId: String(item.getId()),
      fieldTitle: fieldTitle,
      fieldType: fieldType
    };
  },

  getLatestResponse: function (form) {
    form = form || this.getActiveForm();
    var responses = form.getResponses().slice().sort(function (a, b) {
      return a.getTimestamp().getTime() - b.getTimestamp().getTime();
    });
    if (!responses.length) throw new Error('No form response found. Submit one response before using Test latest response.');
    return this.fromFormResponse(responses[responses.length - 1], form);
  },

  fromSubmitEvent: function (event) {
    if (!event || !event.response) throw new Error('Form submission data is unavailable.');
    return this.fromFormResponse(event.response, event.source || null);
  },

  fromFormResponse: function (formResponse, form) {
    var responseMap = {};
    if (form) {
      this.getFields(form).forEach(function (field) {
        responseMap[field.fieldId] = {
          fieldId: field.fieldId,
          title: field.fieldTitle,
          value: ''
        };
      });
    }
    formResponse.getItemResponses().forEach(function (itemResponse) {
      var field = FieldService.toField(itemResponse.getItem());
      responseMap[field.fieldId] = {
        fieldId: field.fieldId,
        title: field.fieldTitle,
        value: FieldService.normalizeResponseValue(itemResponse.getResponse())
      };
    });
    return responseMap;
  },

  normalizeResponseValue: function (value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(function (item) { return String(item); }).join(', ');
    if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
    return String(value);
  }
};
