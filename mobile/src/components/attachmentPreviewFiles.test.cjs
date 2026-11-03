// Run: node --test src/components/attachmentPreviewFiles.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function fixture() {
  const calls = { get: [], write: [], remove: [], share: [] };
  const session = { revision: 0 };
  const api = { get: async (...args) => { calls.get.push(args); return { data: { size: 4 } }; } };
  const disk = {
    cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' },
    writeAsStringAsync: async (...args) => { calls.write.push(args); },
    deleteAsync: async (...args) => { calls.remove.push(args); },
  };
  const sharing = {
    isAvailableAsync: async () => true,
    shareAsync: async (...args) => { calls.share.push(args); },
  };
  const modules = { axios, 'expo-file-system/legacy': disk, 'expo-sharing': sharing, '@/api/client': { api, session } };
  const output = ts.transpileModule(fs.readFileSync(`${__dirname}/attachmentPreviewFiles.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, require: id => { if (!modules[id]) throw new Error(`Unexpected module ${id}`); return modules[id]; },
    FileReader: class { readAsDataURL() { this.result = 'data:image/jpeg;base64,YWJjZA=='; this.onload(); } },
    Error, Date,
  });
  return { ...exports, calls, api, session, disk, sharing };
}
const remote = { path: '/attachments/123/file', name: 'device.jpg', mime: 'image/jpeg' };

test('protected images use the shared API, write base64, and clean up unique files', async () => {
  const f = fixture();
  const first = await f.prepareAttachment(remote);
  const second = await f.prepareAttachment(remote);
  assert.equal(f.calls.get[0][0], remote.path);
  assert.equal(f.calls.get[0][1].responseType, 'blob');
  assert.equal(f.calls.get[0][1].headers.Authorization, undefined);
  assert.equal(f.calls.get[0][1].headers['Cache-Control'], 'no-cache');
  assert.match(f.calls.get[0][1].params.preview, /^\d+-\d+$/);
  assert.equal(f.calls.write[0][1], 'YWJjZA==');
  assert.notEqual(first.uri, second.uri);
  await first.dispose(); await second.dispose();
  assert.equal(f.calls.remove.length, 2);
});

test('local booking files bypass authentication and are never deleted', async () => {
  const f = fixture();
  const local = { uri: 'file:///picker/photo.jpg', name: 'photo.jpg', mime: 'image/jpeg' };
  const file = await f.prepareAttachment(local);
  assert.equal(file.uri, local.uri);
  await file.dispose();
  assert.equal(f.calls.get.length, 0);
  assert.equal(f.calls.remove.length, 0);
});

test('external URLs cannot receive credentials', async () => {
  const f = fixture();
  for (const path of ['https://other.test/file', '//other.test/file', '/auth/me']) {
    await assert.rejects(f.prepareAttachment({ ...remote, path }), /Unsupported/);
  }
  await assert.rejects(f.prepareAttachment({ uri: 'https://other.test/file', name: 'x', mime: 'image/jpeg' }), /Unsupported/);
  assert.equal(f.calls.get.length, 0);
});

test('canceling during download prevents a cache write', async () => {
  const f = fixture();
  const controller = new AbortController();
  f.api.get = async () => { controller.abort(); return { data: { size: 4 } }; };
  await assert.rejects(f.prepareAttachment(remote, controller.signal), axios.isCancel);
  assert.equal(f.calls.write.length, 0);
});

test('an account change during cache write removes the file and prevents opening', async () => {
  const f = fixture();
  f.disk.writeAsStringAsync = async () => { f.session.revision++; };
  await assert.rejects(f.openAttachment(remote), axios.isCancel);
  assert.equal(f.calls.remove.length, 1);
  assert.equal(f.calls.share.length, 0);
});

test('PDF opening includes its MIME type and cleans up after dismissal', async () => {
  const f = fixture();
  await f.openAttachment({ path: '/invoices/123/pdf', name: 'invoice.pdf', mime: 'application/pdf' });
  assert.equal(f.calls.share[0][1].mimeType, 'application/pdf');
  assert.equal(f.calls.share[0][1].UTI, 'com.adobe.pdf');
  assert.equal(f.calls.remove.length, 1);
});

test('unavailable sharing does not download; failed opening still cleans up', async () => {
  const f = fixture();
  f.sharing.isAvailableAsync = async () => false;
  await assert.rejects(f.openAttachment(remote), /unavailable/);
  assert.equal(f.calls.get.length, 0);
  f.sharing.isAvailableAsync = async () => true;
  f.sharing.shareAsync = async () => { throw new Error('No compatible app'); };
  await assert.rejects(f.openAttachment(remote), /No compatible app/);
  assert.equal(f.calls.remove.length, 1);
});

test('permission and missing-file errors are actionable and never write to disk', async () => {
  const f = fixture();
  for (const [status, message] of [[401, /Sign in/], [403, /permission/], [404, /no longer/]]) {
    const error = new axios.AxiosError('Request failed', undefined, undefined, undefined, { status });
    f.api.get = async () => { throw error; };
    await assert.rejects(f.prepareAttachment(remote), err => err === error);
    assert.match(f.previewError(error), message);
  }
  assert.equal(f.calls.write.length, 0);
});

test('a failed request can be retried without retaining the failed result', async () => {
  const f = fixture();
  const success = f.api.get;
  f.api.get = async () => { throw new axios.AxiosError('Network error'); };
  await assert.rejects(f.prepareAttachment(remote));
  f.api.get = success;
  const file = await f.prepareAttachment(remote);
  assert.equal(f.calls.write.length, 1);
  await file.dispose();
});

test('empty files and failed cache writes never open a native viewer', async () => {
  const f = fixture();
  f.api.get = async () => ({ data: { size: 0 } });
  await assert.rejects(f.openAttachment(remote), /empty/);
  f.api.get = async () => ({ data: { size: 4 } });
  f.disk.writeAsStringAsync = async () => { throw new Error('Storage full'); };
  await assert.rejects(f.openAttachment(remote), /Storage full/);
  assert.equal(f.calls.remove.length, 1);
  assert.equal(f.calls.share.length, 0);
});
