const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../../backend/node_modules/typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname + '/dateTime.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsForTest, Date, Intl });
const { formatDateOnly, formatDateTime, formatTime, formatTimeSlot } = exportsForTest;
assert.equal(formatDateOnly('2026-09-13'), 'Sun, 13 Sep 2026');
assert.equal(formatDateTime('2026-09-13T07:00:00Z'), 'Sun, 13 Sep 2026, 12:30 PM');
assert.equal(formatDateOnly('2026-09-12T20:00:00Z'), 'Sun, 13 Sep 2026');
assert.equal(formatDateTime('2026-09-13'), 'Sun, 13 Sep 2026');
assert.equal(formatDateOnly('2026-02-31'), '-');
assert.equal(formatDateTime('invalid'), '-');
for (const [input, expected] of [['00:00', '12:00 AM'], ['12:00', '12:00 PM'], ['13:30', '1:30 PM'], ['1pm', '1:00 PM'], ['01:15 PM', '1:15 PM']]) {
  assert.equal(formatTime(input), expected);
}
assert.equal(formatTimeSlot('9am - 13:30'), '9:00 AM – 1:30 PM');
console.log('PASS admin date/time format, India timezone, slots, invalid dates');
