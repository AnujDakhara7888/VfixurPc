# Owner workflow update

Deployment update (8 September 2026): the backend, admin and additive database migration are now live. Supabase public table access has been restricted. See DEPLOYMENT-20260908.md for verified checks, installation links and the remaining iPhone signing/email configuration.

## Implemented

- The invoice generator and generation API are removed. Admin/operations upload prepared PDFs (invoice, receipt or service report). Customers download them from the ticket. The PDF is the authoritative document; the app does not recalculate its financial values.
- Eleven service-specific booking forms, with optional technical details, conditional questions, a review screen, and recorded Terms/Privacy version and consent time. Customer media uploads follow ticket creation; failed uploads can be retried from the ticket.
- An admin service catalogue controls questions, brands/model suggestions, issue choices, enabled categories, display order and service modes.
- Saved devices and service history, including booking again.
- Pickup, carry-in, on-site, remote and consultation options. Higher-risk malware requests exclude remote support. Appointment dates and active slots are checked by the backend.
- Customer unread alerts and app badges, foreground banners, notification-to-ticket navigation, and Expo tokens for both iOS and Android. Admin has a polling inbox and optional email alerts for bookings and quote decisions.
- Customer-visible workshop photos/videos, including field-agent condition photos. New document and media bytes are kept in PostgreSQL so a Cloud Run restart does not lose them.
- Quote review is red. Quote approval is green. Revisions and decisions preserve the previous quote, amount, actor and time. Approval of an outdated version is rejected. Repair cannot start before approval.
- Google Calendar add-event links on tickets and delivery tasks, using Asia/Kolkata time. These open a prefilled event; they do not silently write to anyone's calendar or provide two-way Google sync.
- Phone-friendly admin navigation and layouts, installable web manifest, and public /privacy, /terms and /account-deletion pages. The supplied 45 FAQs are included in the app.
- The business draft's completed contact details in its Terms section are used for the Privacy Policy's placeholders.

## Deployment sequence

1. Back up the existing database using the normal deployment process.
2. Apply backend/migrations/20260908-owner-workflow.sql once to the intended database before the updated backend starts. Production schema synchronization remains disabled.
3. Deploy the backend and admin together. Verify /api/v1/catalog and the new authenticated endpoints.
4. Configure CORS_ORIGINS for the actual admin origin. Publish the policy routes on the admin domain, or route the main website's /privacy and /terms to these pages.
5. Set the email environment variables below on the backend.
6. Build and install a new EAS development/production mobile binary. New native modules were added for file sharing and media selection. Configure FCM v1 and Apple APNs credentials for EAS project 25ffc62c-2944-4b25-9faa-447fb34814a0.
7. Verify a new booking, quote revision/approval, PDF upload/download and workshop photo on a physical phone. Test notifications with the app foregrounded, backgrounded, and closed.

Email configuration:

- RESEND_API_KEY: a Resend sending key.
- ADMIN_EMAIL_FROM: a sender on a verified domain.
- ADMIN_NOTIFICATION_EMAILS: hriday@vfixurpc.com,tnagesh1999@gmail.com (configured locally and in the example; set the same value in deployment).
- ADMIN_PUBLIC_URL: the deployed admin origin, without /dashboard.

The recipients are configured, but the Resend sending key and verified sender still need to be supplied before email can be delivered. The app inbox works without email credentials. Provider acceptance of a push request does not prove that a particular device displayed it; the physical-device check remains necessary. Expo Go cannot substitute for that check. Android launcher badge appearance depends on the device/launcher.

Open the deployed admin in the phone browser. Use Add to Home Screen to keep it readily available. The admin inbox refreshes while the page is active; email is the off-site/background alert channel. This change does not implement browser Web Push or offline access.

## Existing data

Historical invoices with an accessible PDF already archived in the configured S3 bucket remain downloadable. Snapshot-only invoices need an original PDF uploaded by the office; the application will no longer regenerate them. Existing local-only delivery images are not automatically recovered from old containers. New uploads are durable in the database. Database backup/storage quotas should include the new file data.

## Scope

Payments and AI remain deferred as requested. The documents also describe a wider roadmap (OTP sign-in, full inventory/AMC contracts, secure credential requests, advanced service-area pricing and automatic Google Calendar sync). Those are not introduced by this update. Existing username/password authentication remains in place. Account deletion is a verified support request by email, not an immediate destructive deletion.

## Verification

- Backend unit suite: 13 tests covering inbox persistence and read ownership, uploaded PDF validation and ownership, catalogue configuration, and quote decisions/version checks.
- Backend TypeScript build, mobile TypeScript check and admin production build.
- iOS Metro/Hermes bundle export.
- Browser checks at 390x844 and 1440x1000 using isolated API fixtures: PDF upload controls, alert read action, catalogue save, calendar time and horizontal-overflow assertions.
- scripts/verify-owner-ui.cjs uses local fixture responses and does not change production data.

The local verification above was followed by production migration, backend/admin deployment and controlled live API checks documented in DEPLOYMENT-20260908.md. Email delivery and physical-phone push display remain unverified.
