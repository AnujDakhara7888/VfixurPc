# Deployment status: 8 September 2026

Superseded by `RELEASE-20260909.md` for the latest account, UI and notification
fixes. This document retains the September 8 deployment history.

## Existing services

- Google Cloud project: `vfixurpc`.
- Cloud Run service: `vfixurpc-backend`, region `us-central1`.
- Customer/admin API: https://vfixurpc-backend-160921860149.us-central1.run.app/api/v1
- Database: existing Supabase PostgreSQL database, not Cloud SQL.
- Vercel project: `vfixur-pc`, root directory `admin`.
- Public admin: https://vfixur-pc.vercel.app
- Expo project: https://expo.dev/accounts/anuj7888/projects/vfixurpc

## Live release

- Cloud Run revision `vfixurpc-backend-00010-haf` is live with 100% of production traffic, including notifications and address search.
- Its tagged URL is https://address-update---vfixurpc-backend-hpcj5dthea-uc.a.run.app
- Previous revision `vfixurpc-backend-00008-qul` remains available at the `notification-update` tag; `00006-sid` remains at `owner-update`.
- Backend includes both admin email recipients and `ADMIN_PUBLIC_URL`. Resend key and verified sender are still missing.
- Vercel deployment `dpl_2mcYujKioHYHg6YaM2XvurzdTgdg` was promoted to https://vfixur-pc.vercel.app, including the Google Maps provider disclosure.
- Deployment-specific admin URL (Vercel sign-in protected): https://vfixur-3k8y6c642-anujsureshbhaidakhara-stonybrookes-projects.vercel.app
- Public login, privacy, terms and web manifest routes returned HTTP 200.
- The owner-workflow database migration is applied, including both history enum types. The live catalogue returns all 11 services, and CORS permits the existing admin origin.

## Notification follow-up

- Admin inbox events now cover customer registration and customer photo/video uploads, in addition to booking and quotation decisions. Internal staff notes remain private and do not notify customers.
- Customer quotation, document, workshop-media and delivery notifications are awaited before returning the request, avoiding unfinished background promises on Cloud Run. External HTTP push/email calls have bounded timeouts; failed delivery retains the inbox event. This is not a durable retry queue or a guarantee of delivery.
- Admin web push is deployed and VAPID keys are configured server-side. The private key is never returned to clients. Browser subscriptions are stored in a new RLS-protected table with no Supabase public-role grants. Known push-provider validation blocks arbitrary outbound endpoints; expired subscriptions are removed and logout clears the user's subscriptions.
- On iPhone: open the admin URL in Safari, Share > Add to Home Screen, open that Home Screen app, log in, tap the bell, then Enable device notifications > Allow. Use Send test to check actual delivery. On supported desktop/Android browsers the same bell controls are available.
- The email row currently says sender setup required. `RESEND_API_KEY` and a verified `ADMIN_EMAIL_FROM` are still missing. No email was sent or claimed as delivered.
- Customer native lock-screen push remains unavailable in the free Personal Team build. The preview polls for updates while active, shows a foreground toast for new events and refreshes unread counts when returning to the app. Local badge permission is requested, but no APNs registration is attempted. This does not emulate background push.
- The updated signed iPhone preview was installed and successfully launched at 19:37 local time, then confirmed running. Its bundle contains the foreground activity sync and live API. Home UI removes unlabeled popular-service dots, uses responsive service tiles and keeps scrolled content clear of the status bar. New screenshots/user workflow testing remain outstanding.
- Verification: 28 backend tests passed; backend/admin builds and mobile type checks passed; staging and live API checks passed for staff/customer guards, inbox isolation, subscription persistence, unsafe endpoint rejection and logout cleanup. Disposable verification users/events were removed; no real notifications were sent. Admin UI opt-in/test/opt-out were tested with mocked browser push, not physical push delivery.
- `scripts/verify-notification-release.cjs` is the silent production check. The older `verify-live-release.cjs` now additionally requires `VFIXURPC_ALLOW_STAFF_TEST_ALERTS=1`, because registration/uploads now deliberately alert staff.
- Android's earlier APK does not include this later UI/foreground-sync update. Physical browser push, native Android push and email delivery have not been verified. Existing npm dependency audit findings were not addressed in this focused change.

## Pickup address follow-up

- Root cause: the service-flow rewrite replaced Google autocomplete with a plain multiline input. The existing local Places key returned a successful result for a public Mumbai search; the old key itself was not the observed cause.
- Restored debounced suggestions through authenticated `POST /places/autocomplete`, using Places API (New), India filtering and Mumbai location bias. The Google key is configured in Cloud Run, not returned to clients. The new iPhone bundle was checked and does not contain that key.
- Added an explicit manual-entry mode, optional flat/floor input, stale-response cancellation, empty/error states, Google Maps attribution and provider policy links. Manual mode makes no suggestion requests. Only the chosen/entered address is submitted with the booking; prediction lists are not stored in the database.
- The address API validates input, disables response caching and uses Nest throttling at 40 requests per user per minute per server instance. Google project quotas/billing remain separate; this is not an account-wide cost cap. Autocomplete is used without session tokens because no Place Details call is required; normal per-request billing applies.
- The public privacy page discloses Google address-search processing. No device location permission is requested.
- Verification: 32 backend tests passed; mobile types and native Release build passed. Both staged and live APIs returned real Google predictions using a public Mumbai query under a disposable customer account. Auth/input validation and notification regression checks passed; disposable users/events were removed without real notifications.
- Updated iPhone build installed and launched at 19:58 local time, with a follow-up process check confirming it stayed running. Visual suggestion selection and booking on the physical phone still require user verification.

## Sharing with a friend

- Admin: send https://vfixur-pc.vercel.app/login. A separate authorized staff account is required; no friend account was created. The site works on iPhone, Android and desktop, and does not require this Mac to stay on.
- Android: after the source-upload approval request, the user replied "ok move on". The approved EAS upload succeeded to the existing `anuj7888` account. Fresh preview build `6f66d2bf-1ba5-49e6-b023-bfdd54e10fce` finished at 21:38 local time and includes notification/UI/address fixes. See `FRIEND-PREVIEW.md` for sharing instructions. No store submission was performed.
- iPhone: the installed Personal Team preview is not a shareable download. Remote distribution through TestFlight requires the developer's paid Apple setup. Direct installation on the friend's connected iPhone from a Mac is a separate alternative with personal-signing limits.
- Deployed admin/backend changes are live after refresh. Customer app code/UI changes require installing an updated build; these previews do not have an over-the-air update channel configured.

## Database protection and safeguards

- Confirmed the Supabase warning: the 13 original tables had RLS disabled and grants to public API roles. This configuration was corrected in production.
- Applied `backend/migrations/20260908-restrict-public-access.sql` before and after the owner-workflow migration. All 15 application tables now have RLS enabled and zero table grants to `anon`, `authenticated` or `PUBLIC`. The direct backend database role retains access.
- The notification follow-up adds a sixteenth protected table, `web_push_subscriptions`, via `20260908-web-push.sql`; its RLS and zero public grants were checked transactionally before commit.
- Verified denied access as both Supabase API roles and successful backend access. Future tables created by `postgres` in `public` no longer automatically grant access to those API roles.
- No customer-record export was performed. A full backup export remained blocked by safety review. The safer alternative was a private schema-only snapshot, `backups/vfixurpc-schema-only-20260908.dump`, with zero data entries. It is not a customer-data backup.
- The additive owner-workflow migration was first rehearsed and rolled back, then applied transactionally with a short lock timeout. No existing customer records were deleted.
- A read-only TypeORM comparison found no missing entity columns or enum values. Only optional index/constraint naming differences remained; automatic schema synchronization was not run.
- Existing provider backups/PITR should be confirmed separately before future destructive changes. PostgreSQL client tools are installed under `/opt/homebrew/opt/libpq/bin`.
- These checks do not establish whether historical unauthorized access occurred. No historical-access audit or store-readiness certification has been performed.

## Open the app

### Admin: either phone

Open https://vfixur-pc.vercel.app/login in Safari or Chrome and sign in with an existing staff account. Refresh to load the updated release. On iPhone, use Share > Add to Home Screen. On Android, use the browser menu's Add to Home screen or Install option if offered. The laptop can be closed.

### Android customer app

The latest preview APK (including notification/UI/address updates) finished on EAS:
https://expo.dev/accounts/anuj7888/projects/vfixurpc/builds/6f66d2bf-1ba5-49e6-b023-bfdd54e10fce

Status: `FINISHED`. Direct APK: https://expo.dev/artifacts/eas/XOwftXc7XYFyMcJrBea7khGdnDa5vJPEJvWWh8Ji6UM.apk

EAS lists the preview expiry as 23 September 2026 at 01:31 UTC. This is not a permanent store-distribution link. The earlier build `a41cf39a-9b36-4ad3-b1fa-f72bce9bb915` is superseded.

Downloaded the finished 70,470,130-byte APK and inspected its embedded Android
JavaScript bundle: live API URL, address-search endpoint and manual-entry UI
are present; the local Google Places key is absent. Physical Android installation
and end-to-end phone workflows remain unverified.

Open the build page on Android, select Install/Download, open the APK, allow this browser to install the package if Android asks, then open VfixurPC. It uses the updated Cloud Run API and does not need the Mac running. The August 30 APKs do not contain the latest changes. Physical Android installation and push display still need owner verification.

### iPhone customer app

The iPhone 14 Pro now has Developer Mode enabled. The user selected their Personal Team in Xcode, and the signed Release preview was successfully installed with `devicectl`. The owner reports no active paid membership.

The first launch was blocked by iOS with a signature/entitlements/profile-trust message. System signature verification passed, and the embedded provisioning profile includes this iPhone. After the user trusted their Apple Development entry, `devicectl` successfully launched the app at 18:47 local time, and a follow-up process check confirmed it was still running. On-device screens and user workflows have not yet been visually verified. The installed profile expires on 15 September 2026 at 22:35 UTC.

- For a shareable installation or TestFlight, enroll in the Apple Developer Program, connect the team to Expo, register the test iPhone for an internal preview, and build an iOS preview.
- A separate personal preview has been configured as `com.vfixurpc.app.personal`, displayed as `VfixurPC Preview`. The normal store identifier and remote-push configuration are unchanged. Personal previews omit the APNs signing entitlement and skip remote push registration; they still support in-app alerts.
- CocoaPods was installed and the native dependencies resolved. The generated workspace is `mobile/ios/VfixurPCPreview.xcworkspace` (ignored by Git/EAS). Configuration remains in `mobile/app.config.js` and `mobile/plugins/withPersonalPreview.js`.
- Xcode initially reported its iOS 26.5 platform components missing. Stale runtime registrations were resolved with a clean installation of the official iOS 26.5 runtime, and the iPhone is an eligible build destination.
- The first native build exposed the upstream fmt 11.0.2 / Apple Clang 21 consteval incompatibility. `mobile/plugins/withFmtCompatibility.js` applies a version-scoped CocoaPods workaround based on https://github.com/expo/expo/issues/44229. Both normal and personal configuration variants are verified: store builds retain the APNs entitlement; personal builds omit it.
- The native iPhone Release build passed, first unsigned and then signed with the selected Personal Team. Its output is `/private/tmp/vfixurpc-ios-build/Build/Products/Release-iphoneos/VfixurPCPreview.app`; the embedded JavaScript bundle was verified to contain the live Cloud Run API URL. The signed build passed system code-signature verification and was installed on the connected iPhone.
- In Xcode > Settings > Accounts, sign in to an Apple Account. Select the VfixurPCPreview target > Signing & Capabilities > Automatically manage signing > the Personal Team.
- Once signing is available, from `mobile` run `npm run ios:personal` and select the connected iPhone. This uses Release configuration, embedding the JavaScript so no Metro/Expo Go development server is needed.
- On iPhone, enable Developer Mode if prompted (Settings > Privacy & Security), restart, and trust the developer under Settings > General > VPN & Device Management if requested. Personal-team provisioning expires after seven days and is not equivalent to production push testing.
- Do not submit this personal variant to stores; use the regular EAS production profile after owner approval and store preparation.

## Verified this deployment attempt

- Initial owner-workflow backend tests: 13 passed; expanded notification suite: 28 passed.
- Backend TypeScript build passed.
- Mobile TypeScript check passed.
- Native iPhone Release compilation, signing, installation and launch passed; bundled JavaScript, live API address and device provisioning verified. A follow-up device process check confirmed the app remained running after launch.
- Cloud Run container build/start passed.
- Vercel production build passed.
- Production migration and live backend/admin promotion completed.
- Controlled live checks passed: registration, hidden credential fields, customer API reads, staff-only permission guards, new history enum writes/reads, authenticated photo round trip, staff PDF upload/download and logout. Every disposable verification account/ticket/document/media/notification was removed. No real staff/customer messages were sent.
- Deployed admin browser checks passed at 390px and 1440px with isolated API fixtures: document upload UI, unread alert, calendar time, catalogue editing and no horizontal overflow.
- `scripts/verify-live-release.cjs` requires `VFIXURPC_LIVE_CHECK=1`; it creates and removes only its own temporary verification data. `OWNER_UI_URL=https://vfixur-pc.vercel.app node scripts/verify-owner-ui.cjs` tests deployed UI with mocked API responses.
- iPhone installation and launch verified; on-device screens and physical-phone workflows remain unverified. No actual email delivery, Android installation or remote push display verified. No App Store or Google Play submission performed.
