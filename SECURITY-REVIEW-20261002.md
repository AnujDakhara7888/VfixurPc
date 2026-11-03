# VfixurPC Release Security Review

Date: 2026-10-02

## Scope

Static review and automated verification of the NestJS API, Next.js admin app,
Expo mobile app, Android native project, dependencies, authentication, request
authorization, payments, uploads, push notifications, and release configuration.

## Fixed in this review

- Enforced production environment validation for database and JWT secrets.
- Added security headers, restrictive CORS, production Swagger gating, and global
  API rate limiting, with strict request DTO validation.
- Hardened password hashing, password length validation, login timing behavior,
  fail-closed customer OTP, OTP comparison, refresh-token handling, and
  authentication endpoint throttles.
- Added ownership and assignment authorization to service requests, quotes,
  attachments, delivery records, photos, and files.
- Changed payment creation to calculate the payable amount on the server, require
  an approved quote, reject cross-customer access, validate captured webhook
  amount/currency, and use timing-safe webhook verification.
- Added payment idempotency protection and the
  `backend/migrations/20261002-payment-integrity.sql` migration.
- Restricted uploads by size and detected MIME type, and added private download
  response headers.
- Prevented FCM tokens from being selected or serialized by default.
- Removed the seeded default administrator password. Seeding now requires a
  strong `SEED_ADMIN_PASSWORD` supplied at runtime.
- Disabled Android backups and removed storage, overlay, silent-download,
  camera, and microphone permissions that the app does not require.
- Restricted outbound Google review links to HTTPS Google hosts.
- Added admin CSP, clickjacking protection, referrer policy, permissions policy,
  and secure strict-same-site cookies.
- Updated vulnerable backend/admin production dependencies. Both production
  dependency audits now report zero known vulnerabilities.

## Required before production or store submission

1. Apply all pending database migrations, including
   `20261002-login-otp-birthday-whatsapp.sql` and
   `20261002-payment-integrity.sql`, before deploying the matching API revision.
2. Rotate the production super-admin password. An old seeded default exists in
   Git history, so it must be treated as disclosed even though it was removed
   from current source.
3. Configure unique random `JWT_SECRET` and `JWT_REFRESH_SECRET` values of at
   least 32 characters and set an explicit production `CORS_ORIGINS` allowlist.
   When `CUSTOMER_LOGIN_OTP_ENABLED=true`, valid MSG91 credentials and an
   approved template are required; customer login intentionally fails closed
   if SMS delivery is not configured.
4. Verify the production PostgreSQL certificate chain. Do not disable
   `DB_SSL_REJECT_UNAUTHORIZED` merely to make deployment pass.
5. Restrict the Firebase API key in Google Cloud to the Android package name and
   production signing certificate, and restrict it to only the required APIs.
6. Create the Play Store AAB with the production upload key or EAS production
   credentials. The local release AAB/APK is signed by the Android debug key and
   must not be submitted to Play Console.
7. Build iOS with an Apple Distribution certificate, App Store provisioning,
   and production APNs entitlement. A personal-team preview is not an App Store
   artifact and cannot receive normal background push notifications.
8. Re-run authenticated smoke tests against a no-traffic API revision before
   moving production traffic.

## Residual risks

- The mobile production dependency audit still reports issues in Expo CLI/build
  tooling and React Navigation's legacy query-string dependency. A forced npm
  audit fix would make incompatible framework changes. Upgrade Expo/React
  Navigation in a dedicated tested release rather than forcing those versions
  immediately before submission.
- Admin access and refresh tokens are stored in JavaScript-readable cookies.
  CSP and cookie flags reduce exposure, but the stronger long-term design is a
  server-side session/BFF using HttpOnly cookies.
- Security is not a one-time guarantee. Enable database backups, centralized
  audit logs, alerting, dependency scanning, and periodic access reviews after
  launch.

## Verification completed

- Backend: 25 test suites, 167 tests passed; production build passed.
- Admin: production build passed; production dependency audit clean.
- Mobile: TypeScript check passed.
- Android: release APK and AAB assembled successfully; merged manifest inspected.
- Backend production dependency audit clean.
- Git whitespace validation passed.
