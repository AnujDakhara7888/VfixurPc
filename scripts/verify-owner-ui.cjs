const {
  chromium,
} = require("/Users/anujdakhara/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const catalog = require("../backend/src/catalog/catalog.defaults.json");
const adminUrl = process.env.OWNER_UI_URL || "http://localhost:3001";
const id = "11111111-1111-4111-8111-111111111111";
const customer = {
  id: "customer",
  name: "Test Customer",
  phone: "+919999999999",
  email: "customer@example.test",
};
const sr = {
  id,
  bookingId: "22222222-2222-4222-8222-222222222222",
  bookingPosition: 0,
  booking: { id: "22222222-2222-4222-8222-222222222222", reference: "VFB-TEST", transportBase: 500, transportTax: 90 },
  serviceRequestNumber: "VFX-TEST",
  status: "QUOTE_APPROVED",
  quoteApproved: true,
  quoteVersion: 2,
  serviceCategory: "laptop",
  serviceMode: "PICKUP",
  bookingAnswers: { brand: "Dell", model: "Inspiron 15" },
  customer,
  device: { brand: "Dell", model: "Inspiron 15" },
  issues: [{ id: "issue", category: "Battery problem" }],
  pickupSlotDate: "2026-09-15",
  pickupSlotTime: "14:00 - 14:30",
  pickupAddress: "Vile Parle West, Mumbai 400056",
  quoteItems: [
    {
      id: "quote",
      description: "Battery replacement",
      unitPrice: 2000,
      quantity: 1,
      total: 2000,
      taxRate: 18,
    },
  ],
  createdAt: "2026-09-08T09:00:00Z",
  statusHistory: [],
  relatedRequests: [
    { id, serviceRequestNumber: "VFX-TEST", status: "QUOTE_APPROVED", device: { brand: "Dell", model: "Inspiron 15" } },
    { id: "33333333-3333-4333-8333-333333333333", serviceRequestNumber: "VFX-TEST-2", status: "QUOTE_APPROVED", device: { brand: "HP", model: "Pavilion" } },
  ],
};
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    fs.mkdirSync("/private/tmp/vfixurpc-ui", { recursive: true });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 1000 },
    ]) {
      const context = await browser.newContext({ viewport });
      await context.addCookies([
        { name: 'access_token', value: 'ui-fixture-access', url: adminUrl },
        { name: 'refresh_token', value: 'ui-fixture-refresh', url: adminUrl },
      ]);
      await context.addInitScript(() => {
        let subscription = null;
        const manager = {
          getSubscription: async () => subscription,
          subscribe: async () => subscription = {
            endpoint: 'https://web.push.apple.com/isolated-ui-fixture',
            toJSON: () => ({ endpoint: 'https://web.push.apple.com/isolated-ui-fixture', keys: { p256dh: 'fixture', auth: 'fixture' } }),
            unsubscribe: async () => { subscription = null; return true; },
          },
        };
        const registration = { pushManager: manager };
        Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => registration, getRegistration: async () => registration, ready: Promise.resolve(registration) } });
        Object.defineProperty(window, 'Notification', { value: { permission: 'granted', requestPermission: async () => 'granted' } });
        if (!('PushManager' in window)) Object.defineProperty(window, 'PushManager', { value: function () {} });
      });
      let read = false,
        uploaded = false,
        saved = false,
        subscribed = false;
      await context.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.split("/api/v1")[1];
        let body = {};
        if (path === "/users/me")
          body = { id: "admin", name: "Office Admin", role: "SUPER_ADMIN" };
        else if (path === "/notifications/unread-count")
          body = { count: read ? 0 : 1 };
        else if (path === '/notifications/delivery-settings')
          body = { email: { configured: false }, webPush: { enabled: true, publicKey: Buffer.alloc(65, 4).toString('base64url') } };
        else if (path === '/notifications/web-push') {
          subscribed = route.request().method() === 'POST';
          body = { subscribed };
        }
        else if (path === '/notifications/web-push/test') body = { accepted: subscribed ? 1 : 0 };
        else if (path === "/notifications")
          body = [
            {
              id: "event",
              message: "Quote approved: VFX-TEST.",
              serviceRequestId: id,
              readAt: read ? "2026-09-08" : null,
              sentAt: "2026-09-08T10:00:00Z",
            },
          ];
        else if (path.endsWith("/read")) {
          read = true;
          body = { count: 0 };
        } else if (path === "/catalog/all" || path === "/catalog")
          body = catalog;
        else if (
          path.startsWith("/catalog/") &&
          route.request().method() === "PUT"
        ) {
          saved = true;
          body = JSON.parse(route.request().postData());
        } else if (path === "/service-requests/" + id) body = sr;
        else if (path.endsWith('/warranty')) body = { coverage: null, claims: [], active: false, canClaim: false };
        else if (path.endsWith("/invoice/upload")) {
          uploaded = true;
          assert.match(route.request().postData(), /MANUAL-001/);
          body = { id: "document" };
        } else if (path.endsWith("/invoice")) body = [];
        else if (path.endsWith("/attachments")) body = [];
        else if (path.includes("/delivery/bookings/") && path.endsWith('/plans'))
          body = [
            { id: '44444444-4444-4444-8444-444444444444', direction: 'PICKUP', status: 'PLANNED', version: 0 },
            { id: '55555555-5555-4555-8555-555555555555', direction: 'RETURN', status: 'PLANNED', version: 0 },
          ];
        else if (path.startsWith("/delivery/")) body = [];
        else if (path.startsWith("/users")) body = { data: [{ id: 'agent', name: 'Field Agent', role: 'DELIVERY_AGENT', isActive: true }] };
        else if (path === "/service-requests") body = { data: [sr], total: 1 };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(adminUrl + "/dashboard/service-requests/" + id);
      await page.getByText("Quote V2 approved by customer").waitFor().catch(async error => {
        fs.writeFileSync(`/private/tmp/vfixurpc-ui/owner-failure-${viewport.width}.txt`, await page.locator('body').innerText());
        await page.screenshot({ path: `/private/tmp/vfixurpc-ui/owner-failure-${viewport.width}.png`, fullPage: true });
        throw error;
      });
      await page.getByText("One shared pickup and one shared return cover every device listed in this booking.").waitFor();
      await page.screenshot({
        path: "/private/tmp/vfixurpc-ui/ticket-" + viewport.width + ".png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Ticket horizontal overflow",
      );
      const calendar = await page
        .getByText("Add appointment to Google Calendar")
        .getAttribute("href");
      assert.ok(calendar.includes("20260915T140000"));
      await page.getByLabel("Document reference").fill("MANUAL-001");
      await page
        .locator("input[type=file]")
        .first()
        .setInputFiles({
          name: "manual.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4 test"),
        });
      await page
        .getByRole("button", { name: "Upload document", exact: true })
        .click();
      await page.getByText("Document shared with customer").waitFor();
      assert.ok(uploaded);
      await page
        .getByRole("button", { name: "Notifications", exact: true })
        .click();
      await page.getByText('Email: sender setup required').waitFor();
      await page.getByRole('button', { name: 'Enable device notifications' }).click();
      await page.getByText('Device notifications enabled', { exact: true }).waitFor();
      assert.ok(subscribed);
      await page.getByRole('button', { name: 'Send test', exact: true }).click();
      await page.getByText('Test accepted by the push service. Check your device.').waitFor();
      await page.getByRole('button', { name: 'Turn off device notifications' }).click();
      await page.getByRole('button', { name: 'Enable device notifications' }).waitFor();
      assert.equal(subscribed, false);
      await page.screenshot({ path: '/private/tmp/vfixurpc-ui/alerts-' + viewport.width + '.png', fullPage: true });
      await page
        .getByRole("button")
        .filter({ hasText: "Quote approved: VFX-TEST." })
        .click();
      assert.ok(read);
      await page.goto(adminUrl + "/dashboard/services");
      await page
        .getByRole("button", { name: "Laptop Repair", exact: true })
        .click();
      await page.getByText("Questions, brands and models").waitFor();
      await page.screenshot({
        path: "/private/tmp/vfixurpc-ui/catalog-" + viewport.width + ".png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Catalogue horizontal overflow",
      );
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText("Service updated", { exact: true }).waitFor();
      assert.ok(saved);
      assert.deepEqual(errors, []);
      console.log(
        "PASS " +
          viewport.width +
          "px: document upload, unread alert, calendar time, catalogue edit and no overflow",
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
