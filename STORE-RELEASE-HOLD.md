# Store release gate - 15 September 2026

Status: HOLD. No store submission is authorised by this checklist.

## Implemented and locally verified

- Account anonymisation and in-app/public-web deletion with reauthentication.
- Upgrade selection persistence through review, payload and request details.
- Separate carry-in, pickup/delivery, on-site and consultation workflows.
- Immediate quote decision state and itemised GST.
- Production FAQ/debug-control cleanup.
- Required Data Recovery and Backup lead fields.
- Requests navigation, notification bell, Android safe-area and scroll checks.
- Honest workflow tracking and consistent customer dates/times.
- Invoice-reference conflicts instead of internal-server errors.
- Shared multi-device booking, individual quotes/status/warranty and one transport fee.
- Disclosed diagnosis fee: INR 500 + INR 90 GST on eligible quote rejection.
- Disclosed pickup/delivery fee: INR 500 + INR 90 GST once per booking.
- Compact booking arrangement and review UI with no duplicated upgrade text.
- Single-device compatibility fallback while the grouped-booking API rolls out;
  multi-device requests are never silently split into separate bookings.
- Admin upgraded to Next.js 16.3.5 and its asynchronous ticket route repaired.
- Firebase Admin 14 integration migrated to its modular API.
- Production database booking, transport and FAQ cleanup migrations applied in
  one transaction with no public table grants and no customer record deletion.

Verification completed:

- Backend: 19 suites, 149 tests; production build passed.
- Mobile: TypeScript passed; Expo Doctor 18/18.
- Booking/preview browser regression: 60 screenshots, 0 failures across
  320x568, 430x932 and 390x844 viewports.
- Owner admin, account deletion and warranty/customer-collection browser flows
  passed at mobile and desktop widths.
- Final personal iOS Release build installed and launched on Anuj's iPhone.

## Release blockers until proven

- Retention policy: owner requests invoice/tax/warranty retention; retention duration,
  restricted access and erasure of backups/external copies still require review.
- Razorpay is not active. No live collection, QR, paid state or charge is enabled.
- Native iOS remote push and store distribution require paid Apple membership.
- The new backend revision is not deployed. Production still uses the previous
  Cloud Run revision until explicit source-upload/deployment approval is given.
- A shareable Android APK still requires an EAS cloud source upload/build, which
  also requires explicit approval. No Android SDK/ADB is installed locally.
- The Brevo API key exposed in conversation should be rotated before release and
  the Google Secret Manager version updated; this has not been done silently.
- npm still reports advisories in Nest 11's pinned Multer and the Expo 54 tool
  chain. Nest 12 currently conflicts with the rate-limiter peer range; forcing
  that invalid tree was rejected. Expo major migration requires its own native
  regression cycle.
- Actual Android/iOS permission, background-push, clean-install, accessibility,
  offline/session-expiry and small/large-device walkthroughs must pass.
- Migration, backend/API regressions, admin/mobile build and fixture tests must pass.
- Store privacy disclosures, Data Safety, reviewer credentials and business policy
  must match deployed behaviour. Approval is Apple's/Google's decision.

## Policies checked

- https://developer.apple.com/support/offering-account-deletion-in-your-app
- https://support.google.com/googleplay/android-developer/answer/13327111

Existing invoice/tax/warranty records must not be destroyed by account deletion.
Photo/video upload under normal use is confirmed working; do not replace that
working path while addressing PDF uploads and permission/error states.
