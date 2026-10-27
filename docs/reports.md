# Management reports

Province coverage and location rankings are currently hidden in the Reports
interface. `SHOW_LOCATION_REPORTS` in the Reports page controls their visibility;
growth reporting remains visible. Geographic calculations remain available.

Open `/dashboard/reports` as Super Admin (including legacy Owner/Admin accounts). Reports load through
`GET /api/v1/reports?start=2026-10-01&end=2026-10-31&group=week` using the signed-in
user's bearer token. Other roles cannot retrieve the report data.

## Filters and exports

Choose a quick range or enter inclusive start and end dates, select daily,
weekly or monthly grouping, then apply. Dates and calendar boundaries use UTC;
weeks start Monday. First and last periods may be partial. Ranges are limited
to ten years. The selected dates affect revenue and creation trends only.
Status and geographic reports represent the current position, not historical
snapshots. Refresh reloads the current data.

Export downloads the current report as CSV. Separate exports are available for
upcoming boost expirations, all province rows and filtered locations. Location
exports include every matching row, including rows outside the displayed page.
CSV cells are quoted and protected against spreadsheet formula injection.

## Definitions

- **Subscriptions:** Accounts are grouped into active, cancelled, guest,
  expired or other statuses. Active aliases follow subscription handling
  (`active`, `subscribed`, `paid`, `true`), excluding elapsed expiry dates.
  Cancelled remains a distinct status even when paid access remains. Provider
  accounts are identified by provider/veterinarian roles, provider user types,
  or ownership of a non-deleted service provider listing. Accounts appear once;
  provider listings and provider accounts are different quantities. Guests are
  registered accounts, not anonymous visitors. Administrative access alone
  does not imply a paid subscription.
- **Boosters:** Grouped by package name, with active, scheduled, expired,
  inactive and unknown-date counts. Active requires the active flag and
  `start_date <= now < end_date`. Expiring is a subset of active boosts ending
  within seven days. Assigned boosts can exist without a payment, so these
  counts do not establish revenue.
- **Revenue:** Sums actual `completed` transaction amounts in ZAR, using
  integer cents. Groups by transaction creation date because there is no
  separate settled-at column. Classifies boosters using boost transaction
  links or payment metadata, subscriptions using plan identifiers, and
  remaining payments as other/unclassified. Pending, failed, cancelled and
  other transaction statuses are excluded. Figures are gross receipts, not
  net accounting revenue after refunds, tax or gateway fees.
- **Growth:** Shows new user accounts and service provider listings, plus
  cumulative totals including records created before the selected range.
  Currently deleted accounts/listings are excluded from all growth periods;
  this is not an immutable history of past account counts. Provider listings
  include veterinarian categories.
- **Coverage:** All nine South African provinces are shown, plus an
  unclassified row. Province names are matched from user `static_location`
  and linked provider location addresses.
  Matching handles case, punctuation, `KZN` and `Northwest`; it does not guess
  provinces from cities, coordinates or postal codes. Ambiguous or missing
  province names remain unclassified. Identical saved location text is grouped
  ignoring case and repeated whitespace. Combined counts add user accounts
  and provider listings; they are not unique people, population or traffic.
  A zero province count is subject to missing location data.

Database reads are paginated and query failures return an error rather than a
successful report full of zero values. The endpoint returns aggregated data,
not user identities or payment references. Recorded address strings appear
in the location report and are restricted to management roles.

## Verification

Run `node --test scripts/tests/reporting.test.cjs` for report calculations,
date boundaries, geographic matching, CSV escaping, endpoint authorization,
query failures and pagination. Run
`node node_modules/typescript/bin/tsc --noEmit --incremental false` for types.

## Suggested follow-ups

Capture province and city as structured fields when users and providers save
their locations, then backfill existing addresses after review. This makes
city rankings and provider coverage by province reliable without guessing.
Subscription event history would enable churn and retention reporting;
payment settlement timestamps and refund records would support net revenue.
