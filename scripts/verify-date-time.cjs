const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('../backend/node_modules/typescript');
for (const file of ['mobile/src/utils/dateTime.ts', 'admin/src/lib/dateTime.ts']) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Intl, Date });
  for (const [input, expected] of [['13:00', '1:00 PM'], ['14:00', '2:00 PM'], ['02:00', '2:00 AM'], ['00:00', '12:00 AM'], ['12:00', '12:00 PM'], ['23:30', '11:30 PM'], ['01:15 PM', '1:15 PM'], ['13:00:00', '1:00 PM']]) assert.equal(exports.formatTime(input), expected);
  assert.equal(exports.formatTimeSlot('13:00 - 14:00'), '1:00 PM – 2:00 PM');
  assert.equal(exports.formatTimeSlot('9:00 AM - 11:30 AM'), '9:00 AM – 11:30 AM');
  assert.equal(exports.formatDateOnly('2026-09-10'), 'Thu, 10 Sep 2026');
  assert.equal(exports.formatDateOnly('2026-02-31'), '-');
  assert.equal(exports.formatDateOnly('2026-09-09T20:00:00Z'), 'Thu, 10 Sep 2026');
  assert.equal(exports.formatDateTime('2026-09-09T20:30:00Z'), 'Thu, 10 Sep 2026, 2:00 AM');
  assert.equal(exports.formatDateTime('invalid'), '-');
  console.log('PASS ' + file + ': dates, India time zone, midnight/noon, slots and invalid inputs');
}
