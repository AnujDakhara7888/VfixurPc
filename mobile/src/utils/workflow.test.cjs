const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../../backend/node_modules/typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname + '/workflow.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsForTest, Date });
const { requestStages } = exportsForTest;
let stages = requestStages({ status: 'DIAGNOSING', serviceMode: 'CARRY_IN' });
assert.equal(stages.length, 8);
assert.equal(stages.find(s => s.state === 'current').label, 'Diagnosis complete');
stages = requestStages({ status: 'DELIVERED', serviceMode: 'PICKUP', quoteRejectedReason: 'Declined', statusHistory: [
  { toStatus: 'QUOTE_REJECTED', createdAt: '2026-09-13T08:00:00Z' },
  { toStatus: 'REQUEST_RECEIVED', createdAt: '2026-09-13T07:00:00Z' },
] });
assert.ok(stages.some(s => s.label === 'Quote approval'));
assert.equal(stages.at(-1).label, 'Completed');
assert.ok(stages.every(s => s.state === 'complete'));
for (const serviceMode of ['CARRY_IN', 'ON_SITE', 'REMOTE', 'CONSULTATION']) {
  stages = requestStages({ serviceMode, status: 'DIAGNOSING', statusHistory: [{ toStatus: 'PICKED_UP' }] });
  if (serviceMode !== 'CARRY_IN') assert.ok(!stages.some(s => /device collected|return to customer/i.test(s.label)));
}
assert.equal(requestStages({ status: 'DELIVERED', serviceMode: 'CONSULTATION' }).at(-1).label, 'Completed');
assert.equal(requestStages({ status: 'READY_FOR_HANDOVER', serviceMode: 'PICKUP', handoverMethod: 'CUSTOMER_COLLECTION' }).find(s => s.state === 'current').label, 'Collection');
assert.equal(requestStages({ status: 'CANCELLED' }).find(s => s.state === 'cancelled').label, 'Request received');
assert.equal(requestStages({ status: 'PICKED_UP', serviceMode: 'ON_SITE' }).find(s => s.state === 'current').label, 'Request received');
console.log('PASS recorded workflow stages, skipped work, mode-specific labels, cancellation');
