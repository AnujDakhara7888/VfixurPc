const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('/Users/anujdakhara/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.ACCOUNT_UI_URL || 'http://127.0.0.1:3101';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    fs.mkdirSync('/private/tmp/vfixurpc-account-ui', { recursive: true });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const calls = [];
      let wrong = true;
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.startsWith('/api/v1/')) {
          const path = url.pathname.slice('/api/v1'.length);
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-methods': 'POST, DELETE, GET', 'access-control-allow-headers': 'content-type, authorization' } });
          calls.push({ path, method: request.method(), headers: request.headers(), body: request.postDataJSON() });
          let status = 401, body = { message: 'Unexpected staff bootstrap' };
          if (path === '/auth/login') { status = 200; body = { accessToken: 'isolated-customer', user: { role: 'CUSTOMER' } }; }
          if (path === '/auth/account') { status = wrong ? 400 : 200; body = { message: wrong ? 'Incorrect password' : 'Deleted' }; }
          return route.fulfill({ status, headers: { 'access-control-allow-origin': base }, contentType: 'application/json', body: JSON.stringify(body) });
        }
        if (url.origin !== base) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [path, heading] of [['/account-deletion', 'VfixurPC account deletion'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service']]) {
        await page.goto(base + path);
        await page.getByRole('heading', { name: heading, exact: true }).waitFor();
        await page.waitForLoadState('networkidle');
        assert.equal(new URL(page.url()).pathname, path);
        assert.equal(calls.length, 0, 'Public route must not bootstrap/refresh staff auth');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.goto(base + '/privacy');
      await page.getByRole('link', { name: 'Request account deletion' }).click();
      await page.getByRole('heading', { name: 'VfixurPC account deletion' }).waitFor();
      await context.addCookies(['access_token', 'refresh_token'].map(name => ({ name, value: `staff-${name}`, url: base })));
      await page.reload();
      await page.waitForLoadState('networkidle');
      const before = await context.cookies();
      assert.equal(calls.length, 0, 'Public route must leave existing staff cookies alone');
      const submit = page.getByRole('button', { name: 'Permanently delete my account' });
      assert(await submit.isDisabled());
      await page.getByLabel('Username', { exact: true }).fill('customer');
      await page.getByLabel('Confirm your password', { exact: true }).fill('MiXeD!password');
      await page.getByLabel('Type DELETE to confirm permanent account deletion').fill('DELETE');
      await submit.click();
      await page.getByRole('alert').filter({ hasText: 'Incorrect password' }).waitFor();
      assert.equal(calls.length, 2);
      assert.equal(await page.getByLabel('Confirm your password', { exact: true }).inputValue(), '');
      wrong = false;
      await page.getByLabel('Confirm your password', { exact: true }).fill('MiXeD!password');
      await submit.click();
      await page.getByRole('status').filter({ hasText: 'Your account access has been removed' }).waitFor();
      assert.equal(calls.length, 4);
      assert(calls.every(call => !call.path.includes('refresh')));
      for (const call of calls.filter(call => call.path === '/auth/account')) {
        assert.equal(call.headers.authorization, 'Bearer isolated-customer');
        assert.equal(call.headers.cookie, undefined);
        assert.deepEqual(call.body, { password: 'MiXeD!password', confirmation: 'DELETE' });
      }
      assert.deepEqual(await context.cookies(), before, 'Customer deletion must not replace or clear staff cookies');
      await page.screenshot({ path: `/private/tmp/vfixurpc-account-ui/deleted-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}px: logged-out deletion/privacy/terms, client navigation, staff cookie preservation, confirmation, password error, isolated deletion`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
