# Collection and warranty update: 9 September 2026

## Live

- Backend: vfixurpc-backend-00018-kaz, 100% production traffic.
- API: https://vfixurpc-backend-160921860149.us-central1.run.app/api/v1
- Admin: https://vfixur-pc.vercel.app/login
- Vercel deployment: dpl_HCa87T5qv53xTgEjYyGXneC4pEPr.
- Additive warranty/handover migration applied without changing existing customer records.
- Existing Brevo secret binding preserved; recovery-settings reports email=true, sms=false.

## Changes

- Appointment/date displays use dd/mm/yyyy. Displayed times use 1pm, 2am,
  1:30pm and similar. Timestamps use India time; API booking values stay ISO/24-hour.
  Native admin date/time editing controls still follow the browser's locale.
- Super Admin and Operations can mark an eligible completed repair as Collected
  by customer, recording who received it. This closes the existing request as
  DELIVERED with a separate CUSTOMER_COLLECTION handover marker and audit entry.
- Admin issues warranty start/end dates and coverage separately per repair.
  There is no automatic 90-day warranty or insurance/damage-coverage promise.
- Existing coverage can be extended, not silently shortened or rewritten.
- Customers can request warranty follow-up on the same handed-over request
  during its coverage window. No new booking or quote is created.
- Admin accepts/declines a follow-up and resolves accepted work with a required
  customer-visible update. Coverage snapshots and claim history are retained.
- Access checks enforce customer ownership and staff roles. A database constraint
  prevents multiple open claims on one request. New tables have RLS enabled and
  no public anon/authenticated table grants.

## Verification

- 75 backend tests in 12 suites and Nest build passed.
- Admin production build and mobile TypeScript passed.
- Date/time helper checks passed for both frontends, including midnight/noon,
  minute values, ranges, invalid dates and India date boundaries.
- Warranty component browser fixtures passed at 320, 390 and 1440 pixels.
- Deployed admin fixtures passed at 390 and 1440 pixels with mocked API data.
- Staged API checks verified ownership/role guards, coverage issuance, collection,
  same-ticket claims, duplicate prevention, reviews and resolution.
- Staged account/reset regression passed. Disposable verification records were
  cleaned up; these checks did not send real staff emails or customer pushes.

## Mobile delivery

- Android: the user approved the Expo/EAS source upload. Build
  d4111f8e-f67e-40dc-b823-7fc9f3e8d253 was submitted at 17:14 EDT and FINISHED.
  APK: https://expo.dev/artifacts/eas/ceKdQT98vOyU0jfvUWEoAlhl8x089HEsNiZ_HU0IfYw.apk
  The downloaded APK passed archive-integrity verification. EAS lists an expiry
  of 23 September 2026. FRIEND-PREVIEW.md now links to this build, not the older
  13:30 EDT APK. Physical Android installation remains unverified.
- iPhone: Release build and signature verification passed. Artifact:
  /private/tmp/vfixurpc-ios-build/Build/Products/Release-iphoneos/VfixurPCPreview.app
  Installed successfully on Anuj's iPhone 14 Pro at 17:14 EDT and launched
  successfully. Bundle identifier: com.vfixurpc.app.personal. On-device feature
  interaction and physical notification delivery are not verified by installation.
- Personal Team iPhone builds still do not support native remote lock-screen
  push. Physical Android background notification delivery remains unverified.
- No automatic mobile update channel is configured; install replacement builds
  to receive the new customer screens and formatting.
