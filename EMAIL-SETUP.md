# Free transactional email setup

## Status (September 9, 2026)

Brevo is configured for password reset codes and admin customer-activity emails on Cloud Run revision vfixurpc-backend-00018-kaz (100% traffic). The warranty release preserved the existing secret binding. The API previously confirmed an active sender, authenticated vfixurpc.com domain, enabled transactional sending and the Free plan. The backend binds BREVO_API_KEY to version 1 of vfixurpc-brevo-api-key, with secret-level access for its runtime service account. Existing Resend configuration remains supported.

One email titled "VfixurPC email setup test" was sent to hriday@vfixurpc.com through the compiled shared EmailService from the local verification process. Brevo reported delivered at 14:23:10 EDT. This confirms provider delivery to the recipient server, not that the owner saw it in Gmail. It was not a Cloud Run-triggered password reset or customer-activity test. No real account or password was changed. A complete user-initiated reset and staff-activity email test remain to be checked.

The owner chose to retain the saved key. If version 1 contains the key previously pasted into chat, rotate it in Brevo, store the replacement as a new secret version, and update the backend binding before revoking the old key. Never copy either value into these notes.

Verification: 57 backend tests and build passed. Staged account/reset and notification-isolation checks passed with disposable accounts and no real sends. After promotion, production routing confirmed 100% on 00016-cah and recovery-settings returned email=true, sms=false.

Brevo currently offers 300 sends per day on its Free plan. This is a shared allowance for resets and admin alerts, not unlimited sending. Do not enable a paid plan or automatic upgrades. Confirm current limits and any branding in the account before activation.

## Owner setup

1. Open https://www.brevo.com/ and create a Free account using hriday@vfixurpc.com. Complete the verification email in Gmail and the company's onboarding information.
2. Register the sender as VfixurPC <hriday@vfixurpc.com> and authenticate vfixurpc.com using the exact DNS records shown by Brevo. Preserve Google Workspace MX records and existing DKIM records. Review any existing DMARC record before changing it; do not create duplicate DMARC records.
3. Confirm transactional email access is active. If Brevo requires approval, complete their activation process before testing.
4. Generate a Brevo API key (not an SMTP password). Store it directly in Google Cloud Secret Manager, restricted to the backend runtime service account. Never paste it into chat, source control, the mobile application, or Vercel public environment variables.

## Backend activation

The code and configuration are deployed to vfixurpc-backend in vfixurpc / us-central1. For future changes, apply configuration to a no-traffic revision first. Preserve all existing environment variables and secret bindings. Bind a pinned Secret Manager version as BREVO_API_KEY and set:

```dotenv
EMAIL_PROVIDER=brevo
EMAIL_FROM=hriday@vfixurpc.com
EMAIL_FROM_NAME=VfixurPC
```

Preserve ADMIN_NOTIFICATION_EMAILS and ADMIN_PUBLIC_URL. These control the staff recipients and dashboard links, not the sending identity. The provider never needs the Gmail password. No frontend rebuild is required for this backend provider change.

The shared EmailService uses Brevo's HTTPS API with a five-second timeout. It does not silently fall back to a different provider or retry ambiguous requests. Provider acceptance is not proof of inbox delivery. Reset failures invalidate only the matching challenge; admin email failures retain existing inbox events. There is no durable email retry queue in this implementation.

## Acceptance checks before promoting

- Run backend tests and build.
- Check recovery-settings and admin email-settings with the appropriate authentication. A configured flag checks environment presence, not domain verification or deliverability.
- Send a reset only for an authorized test customer. Confirm receipt in Gmail (including Spam), code expiry, single-use reset, and successful login with the new password. Never log or retain the code.
- Trigger one agreed test customer action. Confirm the intended staff receive the email and its link opens the correct authenticated ticket, alongside the in-app alert.
- Check Brevo's transactional logs for acceptance, delivery, bounces, and quota errors. No marketing list import is needed.
- Promote only after the staged checks pass; verify the production endpoints afterward.

This configures email, not Android/iPhone app push or browser Web Push. Gmail notifications depend on the recipient's Gmail and device settings.

## Official references

- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- https://developers.brevo.com/docs/send-a-transactional-email
- https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC
- https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP
