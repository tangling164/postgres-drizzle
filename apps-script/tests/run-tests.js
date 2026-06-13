const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

class FakeProperties {
  constructor() {
    this.values = new Map()
  }
  getProperty(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }
  setProperty(key, value) {
    this.values.set(key, String(value))
    return this
  }
  deleteProperty(key) {
    this.values.delete(key)
    return this
  }
}

const documentProperties = new FakeProperties()
const userProperties = new FakeProperties()
const triggers = []
let triggerShouldFail = false
let uuidCounter = 0
let documentLockEntries = 0
let documentLockDepth = 0
let userLockEntries = 0
let userLockDepth = 0
let formResponses = []

function fakeItem(id, title, type = 'TEXT') {
  return {
    getId: () => id,
    getTitle: () => title,
    getType: () => type,
  }
}

function fakeItemResponse(item, response) {
  return {
    getItem: () => item,
    getResponse: () => response,
  }
}

function fakeFormResponse(timestamp, itemResponses) {
  return {
    getTimestamp: () => new Date(timestamp),
    getItemResponses: () => itemResponses,
  }
}

const formItems = [
  fakeItem(11, 'Budget', 'SCALE'),
  fakeItem(12, 'Message'),
  fakeItem(13, 'Priority'),
  fakeItem(14, 'Layout only', 'SECTION_HEADER'),
]
const activeForm = {
  getId: () => 'form-file',
  getTitle: () => 'Customer Intake Form',
  getItems: () => formItems,
  getResponses: () => formResponses,
}
let currentForm = activeForm

function switchForm(id, title) {
  currentForm = {
    getId: () => id,
    getTitle: () => title,
    getItems: () => formItems,
    getResponses: () => formResponses,
  }
  return currentForm
}

function switchToActiveForm() {
  currentForm = activeForm
  return currentForm
}

const context = {
  console,
  Date,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  RegExp,
  Error,
  isFinite,
  PropertiesService: {
    getDocumentProperties: () => documentProperties,
    getUserProperties: () => userProperties,
  },
  Utilities: {
    getUuid: () => `${String(++uuidCounter).padStart(8, '0')}-0000-0000-0000-000000000000`,
  },
  LockService: {
    getDocumentLock: () => ({
      waitLock() {
        documentLockEntries += 1
        documentLockDepth += 1
        assert.equal(documentLockDepth, 1, 'Document lock must not be nested')
      },
      releaseLock() {
        documentLockDepth -= 1
      },
    }),
    getUserLock: () => ({
      waitLock() {
        userLockEntries += 1
        userLockDepth += 1
        assert.equal(userLockDepth, 1, 'User lock must not be nested')
      },
      releaseLock() {
        userLockDepth -= 1
      },
    }),
  },
  FormApp: {
    getActiveForm: () => currentForm,
  },
  Session: {
    getActiveUser: () => ({ getEmail: () => 'tester@example.com' }),
  },
  ScriptApp: {
    EventType: {
      ON_FORM_SUBMIT: 'ON_FORM_SUBMIT',
      ON_EDIT: 'ON_EDIT',
    },
    getProjectTriggers: () => triggers,
    deleteTrigger: trigger => {
      const index = triggers.indexOf(trigger)
      if (index >= 0) triggers.splice(index, 1)
    },
    newTrigger: () => ({
      form: null,
      forForm(form) { this.form = form; return this },
      onFormSubmit() { return this },
      create() {
        if (triggerShouldFail) throw new Error('Authorization required')
        triggers.push({
          getHandlerFunction: () => 'onFormSubmit',
          getTriggerSourceId: () => this.form.getId(),
          getEventType: () => 'ON_FORM_SUBMIT',
        })
      },
    }),
  },
  UrlFetchApp: {
    fetch: () => ({ getResponseCode: () => 200, getContentText: () => 'ok' }),
  },
}

vm.createContext(context)
const root = path.resolve(__dirname, '..')
const serviceFiles = [
  'ConfigService.gs',
  'LicenseService.gs',
  'RuleEngine.gs',
  'MessageRenderer.gs',
  'PayloadService.gs',
  'FieldService.gs',
  'SlackService.gs',
  'TriggerService.gs',
  'NotificationService.gs',
  'DebugService.gs',
  'ExecutionService.gs',
  'Code.gs',
]
for (const file of serviceFiles) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file })
}

const readFieldsFromForm = context.FieldService.getFields.bind(context.FieldService)
const readLatestResponse = context.FieldService.getLatestResponse.bind(context.FieldService)
const readSubmitEvent = context.FieldService.fromSubmitEvent.bind(context.FieldService)
context.FieldService.getActiveForm = () => currentForm
context.FieldService.getFields = () => [
  { fieldId: '11', fieldTitle: 'Budget', fieldType: 'number' },
  { fieldId: '12', fieldTitle: 'Message', fieldType: 'text' },
  { fieldId: '13', fieldTitle: 'Priority', fieldType: 'text' },
]

let assertions = 0
function test(name, fn) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}
function equal(actual, expected) {
  assertions += 1
  assert.equal(actual, expected)
}
function ok(value) {
  assertions += 1
  assert.ok(value)
}
function throws(fn, pattern) {
  assertions += 1
  assert.throws(fn, pattern)
}

test('numeric operators support all six comparisons and formatted numbers', () => {
  const pairs = [
    ['eq', '$1,000', '1000', true],
    ['neq', '1000', '999', true],
    ['gt', '101', '100', true],
    ['lt', '99', '100', true],
    ['gte', '100', '100', true],
    ['lte', '100', '100', true],
  ]
  for (const [operator, actual, target, expected] of pairs) {
    equal(context.RuleEngine.evaluateCondition({ field: 'Budget', fieldType: 'number', operator, value: target }, { Budget: actual }).matched, expected)
  }
  throws(() => context.RuleEngine.evaluateCondition({ field: 'Budget', fieldType: 'number', operator: 'gt', value: '100' }, { Budget: 'unknown' }), /requires a number/)
})

test('text operators and all or any matching work', () => {
  equal(context.RuleEngine.evaluateCondition({ field: 'Message', fieldType: 'text', operator: 'contains', value: 'REFUND' }, { Message: 'Need a refund today' }).matched, true)
  equal(context.RuleEngine.evaluateCondition({ field: 'Priority', fieldType: 'text', operator: 'text_eq', value: ' high ' }, { Priority: 'High' }).matched, true)
  const filter = {
    match: 'all',
    conditions: [
      { field: 'Budget', fieldType: 'number', operator: 'gt', value: '100' },
      { field: 'Priority', fieldType: 'text', operator: 'text_eq', value: 'High' },
    ],
  }
  equal(context.RuleEngine.evaluate(filter, { Budget: '150', Priority: 'Low' }).matched, false)
  filter.match = 'any'
  equal(context.RuleEngine.evaluate(filter, { Budget: '150', Priority: 'Low' }).matched, true)
  filter.match = 'all'
  filter.conditions[1].enabled = false
  equal(context.RuleEngine.evaluate(filter, { Budget: '150', Priority: 'Low' }).matched, true)
  equal(context.RuleEngine.evaluate({ match: 'all', conditions: [] }, {}).matched, true)
})

test('filter rules prefer stable item IDs when question titles are duplicated', () => {
  const responseMap = {
    21: { fieldId: '21', title: 'Priority', value: 'Low' },
    22: { fieldId: '22', title: 'Priority', value: 'High' },
  }
  equal(context.RuleEngine.evaluateCondition({
    fieldId: '22',
    fieldTitle: 'Priority',
    fieldType: 'text',
    operator: 'text_eq',
    value: 'High',
  }, responseMap).matched, true)
})

test('FieldService reads response-bearing questions and keeps stable item IDs', () => {
  const fields = readFieldsFromForm(activeForm)
  equal(fields.length, 3)
  equal(fields[0].fieldId, '11')
  equal(fields[0].fieldTitle, 'Budget')
  equal(fields[0].fieldType, 'number')
  equal(fields[1].fieldType, 'text')
})

test('FieldService uses the latest Form response and maps Form submit events', () => {
  formResponses = [
    fakeFormResponse('2026-06-08T00:00:00.000Z', [
      fakeItemResponse(formItems[0], 90),
      fakeItemResponse(formItems[1], 'older response'),
    ]),
    fakeFormResponse('2026-06-09T00:00:00.000Z', [
      fakeItemResponse(formItems[0], 150),
      fakeItemResponse(formItems[1], 'refund please'),
      fakeItemResponse(formItems[2], ['High', 'Urgent']),
    ]),
  ]
  const latest = readLatestResponse(activeForm)
  equal(latest['11'].value, '150')
  equal(latest['12'].value, 'refund please')
  equal(latest['13'].value, 'High, Urgent')
  const submitted = readSubmitEvent({ response: formResponses[0], source: activeForm })
  equal(submitted['11'].title, 'Budget')
  equal(submitted['12'].value, 'older response')
  throws(() => readSubmitEvent({ namedValues: { Message: ['legacy Sheet event'] } }), /unavailable/)
  formResponses = []
  throws(() => readLatestResponse(activeForm), /No form response found/)
})

test('message and payload rendering validate variables and preserve special characters', () => {
  equal(context.MessageRenderer.render('Budget: {{Budget}}', { Budget: '150' }), 'Budget: 150')
  equal(context.MessageRenderer.render('Budget: {{Budget}}', { 11: { fieldId: '11', title: 'Budget', value: '175' } }), 'Budget: 175')
  throws(() => context.MessageRenderer.render('{{Missing}}', { Budget: '150' }), /does not match any form field/)
  equal(context.PayloadService.validate('not json', []).valid, false)
  equal(context.PayloadService.validate('{"hello":"world"}', []).valid, false)
  equal(context.PayloadService.validate('{"text":{"type":"plain_text"}}', []).error, 'Payload text must be a string.')
  equal(context.PayloadService.validate('{"blocks":{"type":"section"}}', []).error, 'Payload blocks must be an array.')
  equal(context.PayloadService.validate('{"text":"","blocks":[]}', []).valid, false)
  equal(context.PayloadService.validate('{"blocks":[{"type":"divider"}]}', []).valid, true)
  equal(context.PayloadService.validate('{"text":"{{Missing}}"}', ['Budget']).missingVariables[0], 'Missing')
  const rendered = context.PayloadService.render('{"text":"New {{Message}}","blocks":[]}', { Message: 'quote " and\nnewline' })
  equal(rendered.text, 'New quote " and\nnewline')
  equal(JSON.parse(JSON.stringify(rendered)).text, 'New quote " and\nnewline')
  equal(context.PayloadService.render('{"text":"{{Budget}}"}', { 11: { fieldId: '11', title: 'Budget', value: '150' } }).text, '150')
})

test('SlackService only posts JSON to a valid Slack Incoming Webhook', () => {
  throws(() => context.SlackService.validateWebhook(''), /enter a Slack Webhook/)
  throws(() => context.SlackService.validateWebhook('https://example.com/services/T/B/secret'), /valid Slack Webhook/)
  let request
  context.UrlFetchApp.fetch = (url, options) => {
    request = { url, options }
    return { getResponseCode: () => 200, getContentText: () => 'ok' }
  }
  const webhook = 'https://hooks.slack.com/services/T000/B000/secret'
  equal(context.SlackService.send(webhook, { text: 'hello' }).ok, true)
  equal(request.url, webhook)
  equal(request.options.method, 'post')
  equal(request.options.contentType, 'application/json')
  equal(request.options.payload, '{"text":"hello"}')
  equal(request.options.followRedirects, false)
  equal(Object.prototype.hasOwnProperty.call(context.SlackService.send(webhook, { text: 'hello' }), 'body'), false)
  context.UrlFetchApp.fetch = () => ({ getResponseCode: () => 400, getContentText: () => 'invalid_payload' })
  equal(context.SlackService.send(webhook, { text: 'hello' }).error, 'Slack returned an error. Please check your webhook.')
})

test('mock licenses enforce Free limits and unlock Standard or Business', () => {
  equal(context.LicenseService.getUsage().plan, 'free')
  equal(context.LicenseService.getUsage().creditsLeft, 30)
  context.LicenseService.recordSend()
  equal(context.LicenseService.getUsage().creditsLeft, 29)
  equal(context.LicenseService.activate('STANDARD-TEST').maxConditions, 5)
  context.LicenseService.assertCanSave({ id: null, filter: { conditions: [] } }, Array.from({ length: 9 }, () => ({})))
  throws(() => context.LicenseService.assertCanSave({ id: null, filter: { conditions: [] } }, Array.from({ length: 10 }, () => ({}))), /10 connected Google Forms/)
  equal(context.LicenseService.activate('BUSINESS-TEST').maxForms, 20)
  equal(context.LicenseService.getUsage().maxConditions, 10)
  context.LicenseService.assertCanSave({ id: null, filter: { conditions: [] } }, Array.from({ length: 19 }, () => ({})))
  throws(() => context.LicenseService.assertCanSave({ id: null, filter: { conditions: [] } }, Array.from({ length: 20 }, () => ({}))), /20 connected Google Forms/)
  equal(context.LicenseService.activate('FREE').plan, 'free')
  throws(() => context.LicenseService.activate('BAD-CODE'), /invalid/)
})

const validNotification = {
  name: 'Refund alert',
  enabled: true,
  webhookUrl: 'https://hooks.slack.com/services/T000/B000/secret',
  messageType: 'message',
  messageTemplate: 'Refund: {{Message}}',
  payloadTemplate: '',
  filter: { match: 'all', conditions: [{ fieldId: '12', fieldTitle: 'Message', fieldType: 'text', operator: 'contains', value: 'refund' }] },
}

test('save validation enforces payload JSON and plan condition limits', () => {
  throws(() => context.NotificationService.validateAndNormalize({
    ...validNotification,
    messageType: 'payload',
    payloadTemplate: 'not json',
  }, null), /Payload JSON is invalid/)
  throws(() => context.NotificationService.validateAndNormalize({
    ...validNotification,
    messageType: 'payload',
    payloadTemplate: '{"text":"{{Missing}}"}',
  }, null), /does not match any form field/)
  ok(context.NotificationService.validateAndNormalize({
    ...validNotification,
    messageTemplate: '{{Missing}}',
  }, null).id)

  const conditions = [
    { fieldId: '12', fieldTitle: 'Message', fieldType: 'text', operator: 'contains', value: 'refund' },
    { fieldId: '13', fieldTitle: 'Priority', fieldType: 'text', operator: 'text_eq', value: 'High' },
  ]
  context.LicenseService.activate('FREE')
  throws(() => context.LicenseService.assertCanSave({ id: 'existing', filter: { match: 'all', conditions } }, []), /up to 1 filter condition/)
  const fourConditions = conditions.concat(conditions)
  context.LicenseService.activate('STANDARD-TEST')
  context.LicenseService.assertCanSave({ id: 'existing', filter: { match: 'all', conditions: fourConditions } }, [])
  const sixConditions = fourConditions.concat(conditions)
  throws(() => context.LicenseService.assertCanSave({ id: 'existing', filter: { match: 'all', conditions: sixConditions } }, []), /up to 5 filter conditions/)
  context.LicenseService.activate('BUSINESS-TEST')
  context.LicenseService.assertCanSave({ id: 'existing', filter: { match: 'all', conditions: sixConditions } }, [])
  throws(() => context.LicenseService.assertCanSave({ id: 'existing', filter: { match: 'all', conditions: Array.from({ length: 11 }, () => conditions[0]) } }, []), /up to 10 filter conditions/)
  const noFilter = context.NotificationService.validateAndNormalize({ ...validNotification, filter: { match: 'all', conditions: [] } }, null)
  equal(noFilter.filter.conditions.length, 0)
  equal(noFilter.formTitle, 'Customer Intake Form')
  equal(context.NotificationService.validateAndNormalize({ ...validNotification, name: '' }, null).name, 'Customer Intake Form')
})

test('one Form stores one user-level alert and installs one trigger', () => {
  context.LicenseService.activate('FREE')
  switchToActiveForm()
  const saved = context.NotificationService.save(validNotification)
  ok(saved.notification.id)
  equal(saved.notification.filter.conditions[0].fieldId, '12')
  equal(saved.notification.filter.conditions[0].enabled, true)
  ok(saved.notification.filter.conditions[0].id)
  equal(saved.notification.formId, 'form-file')
  equal(saved.notification.formTitle, 'Customer Intake Form')
  equal(Object.prototype.hasOwnProperty.call(saved.notification, 'sheetId'), false)
  equal(saved.triggerStatus.state, 'enabled')
  equal(triggers.length, 1)
  const storedConfig = JSON.parse(userProperties.getProperty(context.NotificationService.configKey('form-file')))
  equal(storedConfig.webhookUrl, validNotification.webhookUrl)
  const storedIndex = userProperties.getProperty(context.FormAlertConfig.KEYS.FORM_INDEX)
  equal(storedIndex.includes('hooks.slack.com/services'), false)
  equal(storedIndex.includes('Refund: {{Message}}'), false)
  context.TriggerService.ensureFormSubmitTrigger()
  equal(triggers.length, 1)
  const updated = context.NotificationService.save({ ...validNotification, messageTemplate: 'Updated {{Message}}' })
  equal(updated.notification.id, saved.notification.id)
  equal(context.NotificationService.getAll().length, 1)
  switchForm('form-2', 'Support Request Form')
  throws(() => context.NotificationService.save(validNotification), /1 connected Google Form/)
  throws(() => context.NotificationService.save({ ...validNotification, id: 'unknown-id' }), /does not belong/)
  context.LicenseService.activate('STANDARD-TEST')
  context.NotificationService.save(validNotification)
  equal(context.NotificationService.getAll().length, 2)
  switchToActiveForm()
})

test('current plan entitles connected Forms by most recent update', () => {
  context.LicenseService.activate('FREE')
  const all = context.NotificationService.getAllRaw()
  all[1].updatedAt = '2099-01-01T00:00:00.000Z'
  context.NotificationService.writeFormConfig(all[1])
  equal(context.NotificationService.getEnabled().length, 1)
  equal(context.NotificationService.getEntitled().length, 1)
  equal(context.NotificationService.isEntitled(all[1].id), true)
  equal(context.NotificationService.isEntitled(all[0].id), false)
  throws(() => context.LicenseService.assertCanSave({ id: null, filter: validNotification.filter }, context.NotificationService.getAllRaw()), /1 connected Google Form/)
  throws(() => context.NotificationService.save({ ...validNotification, id: 'missing-notification' }), /does not belong/)
  throws(() => context.testNotificationApi({ ...validNotification, id: 'missing-notification' }), /does not belong/)
  throws(() => context.NotificationService.remove('missing-notification'), /not found/)
})

test('Connected Forms supports unique form IDs, title search, and ten-item pagination', () => {
  context.LicenseService.activate('BUSINESS-TEST')
  for (let index = 3; index <= 11; index += 1) {
    switchForm(`form-${index}`, index >= 10 ? 'Duplicate Form Title' : `Form ${index}`)
    context.NotificationService.save(validNotification)
  }
  switchToActiveForm()
  equal(context.NotificationService.getPage('', 1, 10).items.length, 10)
  equal(context.NotificationService.getPage('', 2, 10).items.length, 1)
  equal(context.NotificationService.getPage('Alert 11', 1, 10).total, 0)
  equal(context.NotificationService.getPage('Duplicate Form Title', 1, 10).total, 2)
  equal(context.NotificationService.getPage('Customer Intake Form', 1, 10).total, 1)
  equal(Object.prototype.hasOwnProperty.call(context.NotificationService.getPage('', 1, 10).items[0], 'summary'), false)
  equal(Object.prototype.hasOwnProperty.call(context.NotificationService.getPage('', 1, 10).items[0], 'updatedAt'), false)
  equal(Object.prototype.hasOwnProperty.call(context.NotificationService.getPage('', 1, 10).items[0], 'name'), false)
  ok(context.NotificationService.getPage('', 1, 10).items[0].formId)
  equal(new Set(context.NotificationService.getAllRaw().map(item => item.formId)).size, 11)
  context.LicenseService.activate('STANDARD-TEST')
  equal(context.NotificationService.getEnabled().length, 10)
  context.LicenseService.activate('BUSINESS-TEST')
  equal(context.NotificationService.getEnabled().length, 11)
  equal(context.getSidebarBootstrap().notifications.length, 3)
  equal(context.getSidebarBootstrap().userEmail, 'tester@example.com')
  equal(context.getSidebarBootstrap().formCount, 11)
})

test('Business allows 20 connected Forms, paused Forms count, and Delete releases a slot', () => {
  context.LicenseService.activate('BUSINESS-TEST')
  for (let index = 12; index <= 20; index += 1) {
    switchForm(`form-${index}`, `Form ${index}`)
    context.NotificationService.save(validNotification)
  }
  equal(context.NotificationService.getAllRaw().length, 20)
  const paused = context.NotificationService.getByFormId('form-20')
  context.NotificationService.setEnabled(paused.id, false)
  equal(context.NotificationService.getAllRaw().length, 20)
  switchForm('form-21', 'Form 21')
  throws(() => context.NotificationService.save(validNotification), /20 connected Google Forms/)
  const removed = context.NotificationService.getByFormId('form-20')
  equal(context.TriggerService.getFormSubmitTriggers('form-20').length, 1)
  equal(context.NotificationService.remove(removed.id).ok, true)
  equal(context.TriggerService.getFormSubmitTriggers('form-20').length, 0)
  equal(context.NotificationService.getAllRaw().length, 19)
  context.NotificationService.save(validNotification)
  equal(context.NotificationService.getAllRaw().length, 20)
  switchToActiveForm()
})

test('Pause and Resume change automatic submission behavior without opening the editor', () => {
  context.LicenseService.activate('BUSINESS-TEST')
  switchToActiveForm()
  const notification = context.NotificationService.getCurrentFormConfig()
  let sends = 0
  context.SlackService.send = () => {
    sends += 1
    return { ok: true, responseCode: 200 }
  }
  equal(context.NotificationService.setEnabled(notification.id, false).enabled, false)
  equal(context.NotificationService.getEnabled().length, 19)
  const pausedResults = context.ExecutionService.runAll({ Message: 'refund please' }, notification.formId)
  equal(pausedResults.length, 1)
  equal(pausedResults[0].status, 'paused')
  equal(sends, 0)
  equal(context.DebugService.getLastStatus().status, 'paused')
  equal(context.DebugService.getLastStatus().reasonCode, 'PAUSED')
  equal(context.NotificationService.setEnabled(notification.id, true).enabled, true)
  equal(context.NotificationService.getEnabled().length, 20)
})

test('trigger failures expose needs setup and can be fixed', () => {
  switchToActiveForm()
  triggers.splice(0, triggers.length)
  triggerShouldFail = true
  const saved = context.NotificationService.save(context.NotificationService.getAll()[0])
  equal(saved.triggerStatus.state, 'needs_setup')
  equal(context.DebugService.getLastStatus().reasonCode, 'TRIGGER_SETUP_FAILED')
  triggerShouldFail = false
  equal(context.TriggerService.ensureFormSubmitTrigger().state, 'enabled')
  documentProperties.setProperty(context.FormAlertConfig.KEYS.TRIGGER_ERROR, 'Old setup error')
  equal(context.TriggerService.getStatus().state, 'enabled')
  equal(context.TriggerService.getStatus().error, null)
  documentProperties.deleteProperty(context.FormAlertConfig.KEYS.TRIGGER_ERROR)
})

test('trigger setup ignores other Forms and removes duplicates for the current Form', () => {
  triggers.splice(0, triggers.length)
  triggers.push({
    getHandlerFunction: () => 'onFormSubmit',
    getTriggerSourceId: () => 'other-form',
    getEventType: () => 'ON_FORM_SUBMIT',
  })
  triggers.push({
    getHandlerFunction: () => 'onFormSubmit',
    getTriggerSourceId: () => 'form-file',
    getEventType: () => 'ON_EDIT',
  })
  equal(context.TriggerService.getStatus().installed, false)
  equal(context.TriggerService.ensureFormSubmitTrigger().installed, true)
  equal(triggers.length, 2)
  equal(triggers.some(trigger => trigger.getTriggerSourceId() === 'other-form'), false)
  triggers.push({
    getHandlerFunction: () => 'onFormSubmit',
    getTriggerSourceId: () => 'form-file',
    getEventType: () => 'ON_FORM_SUBMIT',
  })
  equal(context.TriggerService.getFormSubmitTriggers().length, 2)
  equal(context.TriggerService.getStatus().state, 'needs_setup')
  equal(context.TriggerService.getStatus().error, 'Multiple automatic alerts are installed.')
  context.TriggerService.ensureFormSubmitTrigger()
  equal(context.TriggerService.getFormSubmitTriggers().length, 1)
  equal(context.TriggerService.getStatus().state, 'enabled')
  equal(triggers.length, 2)
})

test('execution sends matched responses, skips nonmatches, and records test status', () => {
  context.LicenseService.activate('BUSINESS-TEST')
  switchToActiveForm()
  let sends = 0
  context.SlackService.send = () => {
    sends += 1
    return { ok: true, responseCode: 200 }
  }
  const notification = context.NotificationService.getCurrentFormConfig()
  equal(context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: false }).status, 'sent')
  equal(sends, 1)
  equal(context.ExecutionService.run(notification, { Message: 'hello' }, { isTest: false }).status, 'skipped')
  equal(sends, 1)
  equal(context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: true }).status, 'test')
  equal(sends, 2)
  context.FieldService.getLatestResponse = () => ({ 12: { fieldId: '12', title: 'Message', value: 'refund from latest response' } })
  equal(context.testLatestResponseApi(notification).status, 'test')
  equal(sends, 3)
  const enabledForCurrentForm = notification.enabled === false ? 0 : 1
  const submitResults = context.onFormSubmit({
    source: activeForm,
    response: fakeFormResponse('2026-06-09T12:00:00.000Z', [
      fakeItemResponse(formItems[1], 'refund from form submit'),
    ]),
  })
  equal(submitResults.length, enabledForCurrentForm)
  equal(submitResults.every((result) => result.status === 'sent'), true)
  equal(sends, 3 + enabledForCurrentForm)
  context.SlackService.send = () => ({ ok: false, responseCode: 400, error: 'Slack returned an error. Please check your webhook.' })
  equal(context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: true }).status, 'error')
  equal(context.DebugService.getLastStatus().status, 'error')
})

test('Send Test skips filters, static templates need no response, and latest response test applies filters', () => {
  context.LicenseService.activate('FREE')
  switchToActiveForm()
  let sends = 0
  context.SlackService.send = () => {
    sends += 1
    return { ok: true, responseCode: 200 }
  }
  context.FieldService.getLatestResponse = () => { throw new Error('latest response should not be read') }
  const staticNotification = {
    ...validNotification,
    id: context.NotificationService.getCurrentFormConfig().id,
    messageTemplate: 'Static webhook test',
    filter: {
      match: 'all',
      conditions: [
        { fieldId: '12', fieldTitle: 'Message', fieldType: 'text', operator: 'contains', value: 'never matches' },
        { fieldId: '13', fieldTitle: 'Priority', fieldType: 'text', operator: 'text_eq', value: 'Never' },
      ],
    },
  }
  equal(context.sendTestApi(staticNotification).status, 'test')
  equal(sends, 1)
  context.FieldService.getLatestResponse = () => ({
    12: { fieldId: '12', title: 'Message', value: 'hello' },
    13: { fieldId: '13', title: 'Priority', value: 'Low' },
  })
  equal(context.testLatestResponseApi({ ...staticNotification, filter: { match: 'all', conditions: [] } }).status, 'test')
  equal(sends, 2)
  context.LicenseService.activate('STANDARD-TEST')
  equal(context.testLatestResponseApi(staticNotification).status, 'skipped')
  equal(sends, 2)
})

test('Budget greater than 100 sends while Budget at or below 100 skips', () => {
  context.LicenseService.activate('STANDARD-TEST')
  let sends = 0
  context.SlackService.send = () => {
    sends += 1
    return { ok: true, responseCode: 200 }
  }
  const budgetNotification = {
    ...validNotification,
    messageTemplate: 'High value lead: {{Budget}}',
    filter: {
      match: 'all',
      conditions: [{ fieldId: '11', fieldTitle: 'Budget', fieldType: 'number', operator: 'gt', value: '100' }],
    },
  }
  equal(context.ExecutionService.run(budgetNotification, { Budget: '150' }, { isTest: false }).status, 'sent')
  equal(sends, 1)
  equal(context.ExecutionService.run(budgetNotification, { Budget: '100' }, { isTest: false }).status, 'skipped')
  equal(context.ExecutionService.run(budgetNotification, { Budget: '50' }, { isTest: false }).status, 'skipped')
  equal(sends, 1)
})

test('automatic execution enforces condition limits after a plan downgrade', () => {
  context.LicenseService.activate('FREE')
  let sends = 0
  context.SlackService.send = () => {
    sends += 1
    return { ok: true, responseCode: 200 }
  }
  const downgradedNotification = {
    ...validNotification,
    filter: {
      match: 'all',
      conditions: [
        { fieldId: '12', fieldTitle: 'Message', fieldType: 'text', operator: 'contains', value: 'refund' },
        { fieldId: '13', fieldTitle: 'Priority', fieldType: 'text', operator: 'text_eq', value: 'High' },
      ],
    },
  }
  const result = context.ExecutionService.run(downgradedNotification, { Message: 'refund', Priority: 'High' }, { isTest: false })
  equal(result.status, 'error')
  equal(result.message.includes('Free allows up to 1 filter condition'), true)
  equal(sends, 0)
  equal(context.DebugService.getLastStatus().reasonCode, 'PLAN_LIMIT')
  const original = context.NotificationService.getCurrentFormConfig()
  context.NotificationService.writeFormConfig({ ...original, filter: downgradedNotification.filter, updatedAt: '2099-12-31T00:00:00.000Z' })
  equal(context.NotificationService.getPage('', 1, 10).items[0].entitled, false)
  context.NotificationService.writeFormConfig(original)
})

test('tests do not consume Free credits while real sends do', () => {
  context.LicenseService.activate('FREE')
  switchToActiveForm()
  documentProperties.setProperty(context.FormAlertConfig.KEYS.FREE_CREDITS_USED, '0')
  context.SlackService.send = () => ({ ok: true, responseCode: 200 })
  const notification = context.NotificationService.getCurrentFormConfig()
  context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: true })
  equal(context.LicenseService.getUsage().creditsLeft, 30)
  context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: false })
  equal(context.LicenseService.getUsage().creditsLeft, 29)
  documentProperties.setProperty(context.FormAlertConfig.KEYS.FREE_CREDITS_USED, '30')
  throws(() => context.LicenseService.assertCanSend(), /Free limit reached/)
})

test('Free credits are reserved atomically and rolled back when Slack fails', () => {
  context.LicenseService.activate('FREE')
  switchToActiveForm()
  const notification = context.NotificationService.getCurrentFormConfig()
  documentProperties.setProperty(context.FormAlertConfig.KEYS.FREE_CREDITS_USED, '29')

  context.SlackService.send = () => ({ ok: false, responseCode: 400, error: 'Slack returned an error. Please check your webhook.' })
  equal(context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: false }).status, 'error')
  equal(context.LicenseService.getUsage().creditsUsed, 29)

  context.SlackService.send = () => { throw new Error('Network unavailable') }
  equal(context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: false }).status, 'error')
  equal(context.LicenseService.getUsage().creditsUsed, 29)

  let sends = 0
  context.SlackService.send = () => {
    sends += 1
    return { ok: true, responseCode: 200 }
  }
  equal(context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: false }).status, 'sent')
  equal(context.LicenseService.getUsage().creditsUsed, 30)
  equal(context.ExecutionService.run(notification, { Message: 'refund please' }, { isTest: false }).status, 'error')
  equal(sends, 1)
  equal(context.LicenseService.getUsage().creditsUsed, 30)
})

test('debug logs keep only ten redacted metadata entries', () => {
  const locksBeforeLogs = documentLockEntries
  for (let index = 0; index < 12; index += 1) {
    context.DebugService.write(
      'sent',
      { id: `id-${index}`, name: `customer-${index}@example.com`, webhookUrl: 'SECRET' },
      {
        reasonCode: 'OK',
        reason: 'Failed at https://hooks.slack.com/services/T000/B000/secret for customer@example.com',
        response: 'PRIVATE',
      },
    )
  }
  const logs = context.DebugService.getLogs()
  equal(logs.length, 10)
  equal(documentLockEntries - locksBeforeLogs, 12)
  const text = JSON.stringify(logs)
  equal(text.includes('SECRET'), false)
  equal(text.includes('PRIVATE'), false)
  equal(text.includes('customer@example.com'), false)
  equal(text.includes('hooks.slack.com/services'), false)
  equal(text.includes('notificationName'), false)
  equal(Object.prototype.hasOwnProperty.call(logs[0], 'reason'), false)
  documentProperties.setProperty(context.FormAlertConfig.KEYS.TRIGGER_ERROR, 'Contact admin@example.com about https://hooks.slack.com/services/T/B/secret')
  const debugInfo = JSON.stringify(context.DebugService.getDebugInfo())
  equal(debugInfo.includes('admin@example.com'), false)
  equal(debugInfo.includes('hooks.slack.com/services'), false)
  equal(Object.prototype.hasOwnProperty.call(context.DebugService.getDebugInfo().triggerStatus, 'error'), false)
  equal(context.DebugService.getDebugInfo().formCount, context.NotificationService.getAllRaw().length)
  equal(context.DebugService.getPanelData().lastStatus, 'sent')
  equal(context.DebugService.getPanelData().lastError, null)
  equal(context.DebugService.getPanelData().recentDebugLogs.length, 10)
  documentProperties.setProperty(context.FormAlertConfig.KEYS.DEBUG_LOGS, JSON.stringify([{
    timestamp: '2026-06-09T00:00:00.000Z legacy@example.com',
    notificationId: 'https://hooks.slack.com/services/T/B/secret',
    status: 'private response',
    reasonCode: 'Contact admin@example.com',
    reason: 'Leaked https://hooks.slack.com/services/T/B/secret to legacy@example.com',
    slackResponseCode: 'https://hooks.slack.com/services/T/B/secret',
    responseMap: { Email: 'customer@example.com' },
    payload: { text: 'private response' },
  }]))
  const legacyDebugInfo = JSON.stringify(context.DebugService.getDebugInfo())
  equal(legacyDebugInfo.includes('responseMap'), false)
  equal(legacyDebugInfo.includes('payload'), false)
  equal(legacyDebugInfo.includes('customer@example.com'), false)
  equal(legacyDebugInfo.includes('legacy@example.com'), false)
  equal(legacyDebugInfo.includes('admin@example.com'), false)
  equal(legacyDebugInfo.includes('hooks.slack.com/services'), false)
  equal(legacyDebugInfo.includes('Leaked'), false)
  equal(legacyDebugInfo.includes('"reason"'), false)
  equal(context.DebugService.getLogs()[0].status, 'unknown')
  equal(context.DebugService.getLogs()[0].reasonCode, 'UNKNOWN')
  equal(context.DebugService.getLogs()[0].notificationId, null)
  equal(context.DebugService.getLogs()[0].slackResponseCode, null)
  documentProperties.deleteProperty(context.FormAlertConfig.KEYS.TRIGGER_ERROR)
})

test('legacy document alerts migrate once and keep the legacy array for rollback', () => {
  const previousLegacy = documentProperties.getProperty(context.FormAlertConfig.KEYS.NOTIFICATIONS)
  const previousMarker = documentProperties.getProperty(context.FormAlertConfig.KEYS.LEGACY_MIGRATED)
  documentProperties.deleteProperty(context.FormAlertConfig.KEYS.LEGACY_MIGRATED)
  documentProperties.setProperty(context.FormAlertConfig.KEYS.NOTIFICATIONS, JSON.stringify([
    { ...validNotification, id: 'notif_legacyold', updatedAt: '2026-01-01T00:00:00.000Z' },
    { ...validNotification, id: 'notif_legacynew', updatedAt: '2026-06-01T00:00:00.000Z' },
  ]))
  switchForm('legacy-form', 'Legacy Form')
  ok(context.NotificationService.migrateCurrentFormLegacy().includes('most recently updated'))
  equal(context.NotificationService.getByFormId('legacy-form').id, 'notif_legacynew')
  ok(documentProperties.getProperty(context.FormAlertConfig.KEYS.NOTIFICATIONS).includes('notif_legacyold'))
  context.NotificationService.remove('notif_legacynew')
  equal(context.NotificationService.migrateCurrentFormLegacy(), null)
  equal(context.NotificationService.getByFormId('legacy-form'), null)
  if (previousLegacy === null) documentProperties.deleteProperty(context.FormAlertConfig.KEYS.NOTIFICATIONS)
  else documentProperties.setProperty(context.FormAlertConfig.KEYS.NOTIFICATIONS, previousLegacy)
  if (previousMarker === null) documentProperties.deleteProperty(context.FormAlertConfig.KEYS.LEGACY_MIGRATED)
  else documentProperties.setProperty(context.FormAlertConfig.KEYS.LEGACY_MIGRATED, previousMarker)
  switchToActiveForm()
})

test('single-property storage rejects oversized Form alert data', () => {
  throws(() => context.ConfigService.writeJson(userProperties, 'oversized-test', { template: 'x'.repeat(9100) }), /too large to save/)
  equal(userProperties.getProperty('oversized-test'), null)
})

test('corrupt local property values recover to safe defaults', () => {
  const formIndex = userProperties.getProperty(context.FormAlertConfig.KEYS.FORM_INDEX)
  const logs = documentProperties.getProperty(context.FormAlertConfig.KEYS.DEBUG_LOGS)
  const credits = documentProperties.getProperty(context.FormAlertConfig.KEYS.FREE_CREDITS_USED)
  userProperties.setProperty(context.FormAlertConfig.KEYS.FORM_INDEX, '{"unexpected":true}')
  documentProperties.setProperty(context.FormAlertConfig.KEYS.DEBUG_LOGS, '{"unexpected":true}')
  documentProperties.setProperty(context.FormAlertConfig.KEYS.FREE_CREDITS_USED, 'not-a-number')
  equal(context.NotificationService.getAllRaw().length, 0)
  equal(context.DebugService.getLogs().length, 0)
  equal(context.LicenseService.getUsedCredits(), 0)
  equal(context.LicenseService.getUsage().creditsLeft, 30)
  context.DebugService.write('error', null, { reasonCode: 'EXECUTION_ERROR' })
  equal(context.DebugService.getLogs().length, 1)
  equal(context.DebugService.getLogs()[0].reasonCode, 'EXECUTION_ERROR')
  userProperties.setProperty(context.FormAlertConfig.KEYS.FORM_INDEX, formIndex)
  documentProperties.setProperty(context.FormAlertConfig.KEYS.DEBUG_LOGS, logs)
  documentProperties.setProperty(context.FormAlertConfig.KEYS.FREE_CREDITS_USED, credits)
})

test('manifest and source avoid Drive, Gmail, AI, and server endpoints', () => {
  const manifest = fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8')
  const parsedManifest = JSON.parse(manifest)
  equal(manifest.includes('/auth/drive'), false)
  equal(manifest.includes('/auth/gmail'), false)
  equal(parsedManifest.urlFetchWhitelist[0], 'https://hooks.slack.com/services/')
  equal(JSON.stringify(parsedManifest.oauthScopes.slice().sort()), JSON.stringify([
    'https://www.googleapis.com/auth/script.container.ui',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/forms.currentonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].sort()))
  const source = serviceFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
  equal(/\bDriveApp\b|\bGmailApp\b|\bSpreadsheetApp\b/.test(source), false)
  equal(/\bFormApp\b/.test(source), true)
  equal(/https?:\/\/(?!hooks\.slack\.com)/.test(source), false)
  equal(/\breason\s*:/.test(fs.readFileSync(path.join(root, 'DebugService.gs'), 'utf8')), false)
  const code = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8')
  ok(code.includes('function showSidebar()'))
  ok(code.includes('function onFormSubmit(event)'))
  ok(code.includes('FormApp.getUi()'))
  ok(code.includes('.createAddonMenu()'))
  const sidebar = fs.readFileSync(path.join(root, 'Sidebar.html'), 'utf8')
  ok(sidebar.includes('View all Forms'))
  ok(sidebar.includes('Copy debug info'))
  ok(sidebar.includes('Send Test'))
  ok(sidebar.includes('Test latest response'))
  equal(/\bfetch\s*\(|XMLHttpRequest/.test(sidebar), false)
  ok(sidebar.includes('recentDebugLogs'))
  equal(sidebar.includes('renderLogs'), false)
})

test('Sidebar source preserves the v1.6 refined UI interaction contracts', () => {
  const sidebar = fs.readFileSync(path.join(root, 'Sidebar.html'), 'utf8')
  const code = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8')
  ok(sidebar.includes('conditions.length > 1'))
  ok(sidebar.includes('<option value="all"'))
  ok(sidebar.includes('<option value="any"'))
  ok(sidebar.includes("['eq', '=']"))
  ok(sidebar.includes("['neq', '\\u2260']"))
  ok(sidebar.includes("['contains', 'contains']"))
  ok(sidebar.includes("['text_eq', 'equals']"))
  ok(sidebar.includes('editor.selectionStart'))
  ok(sidebar.includes('editor.value.slice(0, start) + variable + editor.value.slice(end)'))
  ok(sidebar.includes('https://app.slack.com/block-kit-builder/T0B9SHVRGG0/templates'))
  ok(sidebar.includes("confirm('Delete this Form alert?')"))
  ok(sidebar.includes("confirm('Delete this filter?')"))
  ok(sidebar.includes('aria-pressed="'))
  equal(sidebar.includes('FormAlert servers receive neither responses nor Webhooks.'), false)
  ok(sidebar.includes('View plugin error logs'))
  ok(sidebar.includes('Plugin error logs'))
  equal(sidebar.includes('查看插件错误日志'), false)
  equal(sidebar.includes('Unlimited alerts'), false)
  ok(sidebar.includes('getDebugPanelApi'))
  ok(sidebar.includes('conditions.slice((state.filterPage - 1) * 5'))
  ok(sidebar.includes("var delay = kind === 'error' ? 8000 : kind === 'warning' ? 5000 : 3000"))
  equal(sidebar.includes('class="app-header"'), false)
  equal(sidebar.includes('Run on new form responses'), false)
  equal(sidebar.includes('<h2>Status</h2>'), false)
  ok(sidebar.includes('Validate Payload'))
  ok(sidebar.includes('Get Payload'))
  ok(sidebar.includes("icon('upgrade')"))
  ok(sidebar.includes("icon('edit')"))
  ok(sidebar.includes("icon('delete')"))
  ok(sidebar.includes("icon(notification.enabled ? 'pause' : 'resume')"))
  ok(sidebar.includes('.button:hover:not([disabled])'))
  ok(sidebar.includes('.button-secondary:hover'))
  ok(sidebar.includes('.button-danger:hover'))
  ok(sidebar.includes('@media (prefers-reduced-motion: reduce)'))
  equal(sidebar.includes('Use {{Question title}}'), false)
  equal(sidebar.includes('Notification Name'), false)
  equal(sidebar.includes('Notification Status'), false)
  equal(sidebar.includes('Condition Status'), false)
  equal(sidebar.includes('Field Type'), false)
  equal(sidebar.includes('Insert Field'), false)
  equal(sidebar.includes('notification.name'), false)
  equal(sidebar.includes('status-pill'), false)
  ok(sidebar.includes('notification.formTitle'))
  ok(sidebar.includes("notification.enabled ? 'Pause' : 'Resume'"))
  ok(sidebar.includes('insertSelectedField(this.value)'))
  ok(sidebar.includes('state.cursor[state.editor.messageType]'))
  ok(sidebar.includes('state.activeEditorType === state.editor.messageType'))
  ok(sidebar.includes('editor.value.length'))
  ok(sidebar.indexOf('Add Form Field') < sidebar.indexOf('id="editor-area"'))
  ok(sidebar.indexOf('class="message-type-row"') < sidebar.indexOf('id="editor-area"'))
  ok(sidebar.indexOf("'Get Payload</a>'") < sidebar.indexOf('id="editor-area"'))
  equal(sidebar.includes('class="privacy-note"'), false)
  equal(/\{\{[^}\n]*\|/.test(sidebar), false)
  ok(code.includes("NotificationService.getPage('', 1, 3)"))
  ok(code.includes('function refreshFields()'))
  ok(code.includes('function copyDebugInfoApi()'))
  ok(code.includes('function sendTestApi(notification)'))
  ok(code.includes('function testLatestResponseApi(notification)'))
  ok(code.includes('function setNotificationEnabledApi(notificationId, enabled)'))
  ok(sidebar.includes('field.fieldId'))
  ok(sidebar.includes('field.fieldTitle'))
})

console.log(`\n${assertions} assertions passed.`)
