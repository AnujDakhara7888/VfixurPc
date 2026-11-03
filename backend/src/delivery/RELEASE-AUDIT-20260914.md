# Owned Release Audit

No deployment, database migration execution, or production data changes performed.
Existing edits were preserved. No service-requests files, booking screens, or account deletion files were edited.

## Implemented

- Data Recovery storage is required. Backup customer type, backup target, data amount, and users/devices are required, with Not sure supported. Saved definitions cannot omit or hide these questions or force numeric-only users/devices.
- Exact-match, archived FAQ cleanup SQL is in `../faq/20260914-remove-confirmed-test-faq.sql`. It refuses duplicate matching questions and nodes with children; unrelated content remains untouched.
- Non-pickup requests cannot create assignments, upload transport proof, verify transport OTPs, complete assignments, or receive delivery-driven status changes. Their legacy assignments are excluded from active agent tasks. Historical records remain readable.
- Customer notification dates, admin dates, and document timestamps use `Sun,13 Sep2026 / 12:30 PM`; date-only values stay calendar dates and timestamps use Asia/Kolkata. Existing ISO/day-first numeric dates in inbox messages are formatted on read without rewriting stored content.
- Progress displays recorded status milestones and current status, not inferred percentages or completion of skipped diagnosis/repair/testing. Cancellation and customer collection have explicit labels.
- Document uploads validate advertised file types/sizes; default update captions no longer assert a workshop visit.

## Parent Booking Integration

```ts
// Inside the same transaction, after saving the booking and all its requests:
await deliveryService.planBooking(em, booking.id, requests.map(request => request.id));

// app.module.ts: import and add to the TypeORM entities list:
import { BookingTransportTask } from './delivery/entities/booking-transport-task.entity';
```

Signature: `planBooking(em: EntityManager, bookingId: string, requestIds: string[]): Promise<BookingTransportTask[]>`.
The manager must have an active transaction, and each saved request must have the supplied bookingId.
All-PICKUP groups get exactly two PLANNED rows: PICKUP and RETURN. A unique booking/direction constraint makes retries idempotent. No per-device DeliveryAssignment rows are created. All-non-PICKUP groups return an empty list; mixed groups and mismatched membership fail.

Apply `20260914-booking-transport.sql` through the parent's migration process. Admin/operations read APIs:

- `GET /delivery/booking-plans` (oldest 200 planned transport tasks)
- `GET /delivery/bookings/:bookingId/plans`

## Verification

- 54 focused Jest tests passed across catalogue, delivery, notifications, and FAQ suites.
- Backend build and admin/mobile TypeScript checks passed. An earlier parent-owned serviceCategory typing error was gone on the subsequent build.
- `node admin/src/lib/dateTime.test.cjs` passed.
- `node mobile/src/utils/workflow.test.cjs` passed.
- `git diff --check` passed.

## Unresolved / Handoff

- Both SQL migrations are unapplied. FAQ tests check migration safety contracts, not PostgreSQL execution. Validate on a staging snapshot; production FAQ removal is not claimed.
- Parent owns wiring the booking transaction, DeliveryModule import/injection, app entity registration, and atomic booking API validation. This audit does not assert their final integration is complete.
- Transport plans are planning records, not agent assignments. Scheduling/dispatch, plan lifecycle beyond PLANNED, group-level proof/completion, migration of existing per-request assigned work, and an admin planning screen are not implemented here. The list endpoint is capped at 200 and has no pagination yet.
- BookingTransportTask stores bookingId and requestIds without database foreign keys to avoid guessing the parent's new booking schema. Membership is checked transactionally by the helper; parent should add appropriate foreign keys/cascade policy after finalizing that schema.
- Legacy requests with no serviceMode retain existing pickup assignment behavior; new booking transport plans require explicit PICKUP.
- Mobile's shared date formatter, booking screens, other admin inline date formatting, service-request message composition, and the older `scripts/verify-date-time.cjs` are outside this ownership. The old script still expects superseded formats and needs a parent update. Arbitrary free-text date formats are not interpreted.
- UI rendering and real PostgreSQL concurrency/rollback tests were not run. Existing per-request proof/assignment/status writes are not converted into one transaction by this work.
