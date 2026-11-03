# VfixurPC owner and friend preview

Updated: 9 September 2026. See RELEASE-20260909.md for verification and remaining setup.

Latest update: customer collection and per-repair warranty management are live in
the admin/backend. See RELEASE-WARRANTY-20260909.md. The Android APK linked below
includes the new warranty screens and dd/mm/yyyy and 12-hour appointment
formatting. The replacement Android build finished successfully. The new
iPhone build was installed and launched successfully at 17:14 EDT.

## Admin website: iPhone, Android or computer

Open https://vfixur-pc.vercel.app/login and sign in with your assigned staff account.
Customer registration does not grant admin access. A separate friend staff account
has not yet been created; do not share the owner's master password.

On iPhone, open the website in Safari, select Share > Add to Home Screen, and
open it from the new icon. Sign in, tap the bell, choose Enable device
notifications, allow notifications, then use Send test. Actual delivery still
needs testing on your device. Brevo email sending is now configured, and one
company setup email was provider-confirmed delivered. Staff-activity email
receipt still needs an end-to-end check.

## Android customer app

Replacement warranty/date-format build: FINISHED on 9 September 2026.
Download the latest APK:
https://expo.dev/artifacts/eas/ceKdQT98vOyU0jfvUWEoAlhl8x089HEsNiZ_HU0IfYw.apk

Build details:
https://expo.dev/accounts/anuj7888/projects/vfixurpc/builds/d4111f8e-f67e-40dc-b823-7fc9f3e8d253

The September 9 13:30 EDT APK lacks the warranty/date-format update. Use the
replacement link above, not that earlier link.

The earlier September 8 APK does NOT include the account, readable-choice,
Orders-tab, dark-service-icon, recovery and direct Firebase fixes. Do not share
that earlier APK as the corrected release.

Download and open this APK on Android and
allow installation from that browser only if prompted. Open VfixurPC and register
your own customer account. Expo Go is not required.

This EAS preview is listed with an expiry of 23 September 2026. Keep the
downloaded APK for testing; do not treat the temporary link as a permanent
store-distribution link.

This replacement includes pickup-address suggestions, account/cache
isolation, readable choice sheets, Orders tab, dark service tiles, recovery
screen and direct Android push registration. In Alerts, enable notifications
and use Send test after installation. Email password recovery is now configured;
use Forgot password with your registered email and check Gmail, including Spam.
SMS OTP still needs provider setup. Physical
Android installation and background push delivery have not yet been verified.

## iPhone customer app

The latest warranty/date-format update was signature-verified, installed and
launched on Anuj's iPhone 14 Pro at 17:14 EDT on September 9. This replaces
the earlier account/recovery build. Open VfixurPC Preview on the phone.
An on-device feature walkthrough remains pending. These are signed
native apps, not Expo Go. The Personal Team build cannot be shared as a download link.
Your friend's iPhone requires either a separate direct installation from a Mac
with appropriate personal signing, or TestFlight after paid Apple Developer
Program setup. Personal signing expires and requires periodic reinstallation.

The free personal preview supports in-app alerts while active, not native
lock-screen remote push. Admin website Home Screen notifications are separate.

## What to test

1. Install the September 9 Android APK over the earlier preview. Register your
   own customer account and confirm your own name appears, with no other
   customer's devices, orders or alerts.
2. Check readable booking choices, dark service icons, the compact home order
   summary and the separate Orders tab with Active and History views.
3. Create a service request. At the pickup address, type a Mumbai building or
   area and select a suggestion.
   Add a flat/floor separately. Also check Enter manually.
4. Confirm the selected address appears correctly before submitting.
5. In the admin, check the new request and unread activity, then update the request.
   Confirm the configured staff mailboxes receive the customer-activity email.
6. Return to the customer app and check the status and Alerts tab. On Android,
   enable notifications and use Send test. Check a real admin update with the
   phone locked as well; physical background delivery remains unverified.
7. Sign out and test Forgot password using your own registered email. Check
   Inbox and Spam, enter the code only in the app, set a new password and log in.
8. Check appointment dates as dd/mm/yyyy and time slots as 1pm/2am/1:30pm.
   On a coordinated test repair, admin can issue warranty coverage and mark
   Collected by customer. On the customer's same request, submit a warranty
   follow-up and check admin review updates. No blanket 90-day warranty applies.
9. For bugs, send the phone model, steps, screenshot and approximate time. Never
   send passwords or reset codes. SMS OTP and native iPhone lock-screen push are
   not available in this preview.

These previews use the live backend. Test bookings are real records and may
notify staff, so coordinate testing with the owner and label test requests clearly.

## Does the laptop need to stay on?

No. The admin runs on Vercel and the backend runs on Google Cloud. Installed
Release apps connect to that backend over the internet without a Mac or Metro
server. Refresh the admin for web updates; install a new APK/iPhone build for
customer-app code or UI updates. There is no automatic app-update channel yet.
