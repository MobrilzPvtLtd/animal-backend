# Provider access requests

Apply `supabase/migrations/20240101006000_provider_access_requests.sql` before deploying. The equivalent database migration is `database/migrations/057_provider_access_requests.sql`; apply only the migration set used by your environment. This removes direct public/client access to requests; use the authenticated API instead.

Configure existing SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM and (optionally) SMTP_SENDER_EMAIL settings for decision emails.

## Submit

`POST /api/v1/provider-requests` with `Authorization: Bearer <access_token>` and JSON:

```json
{
  "business_name": "Happy Paws Daycare",
  "contact_number": "+27 123 456 789",
  "business_registration_number": "REG-12345",
  "proof_of_ownership_url": "https://your-storage.example/license.jpg"
}
```

Registration is optional. Upload the ownership image using the existing upload flow, then submit its HTTPS URL. Optional fields: `place_id` (existing place ID), `notes`. Applicant identity and pending status come from the server. Successful submission returns HTTP 201 with `{ "request": { ... } }`.

## List

- Applicant: `GET /api/v1/provider-requests?mine=true`
- Admin/Owner/Manager: `GET /api/v1/provider-requests`
- Optional `status=pending|approved|rejected`, `page=1` (100 requests per page). Response includes `requests`, `page`, and `has_more`.

## Review

Admin/Owner/Manager: `PATCH /api/v1/provider-requests?request_id=123`:

```json
{ "status": "approved", "reason": "Your ownership documentation has been verified." }
```

Use `rejected` to reject. A nonempty reason is required for either decision. Approval atomically creates a verified service provider linked through `service_providers.user_id`, and records its ID on the request. It does not grant management roles. A reviewed request cannot change decisions. Repeating the same status and reason permits retrying a failed email without creating another provider.

The email contains the saved decision and reason. If SMTP fails, the decision stays saved and the response includes `email_sent: false` and a warning. The admin UI offers **Retry decision email**. SMTP acceptance is recorded, rather than claiming inbox delivery. A crash after SMTP acceptance but before recording it can result in a duplicate email on retry.

## Admin panel

Open **Service Providers > Requests**. The box displays pending and total counts. Select a request to inspect contact details, registration, and proof; enter the reason and select **Accept** or **Reject**. All statuses are available in the list.

## Verification

`node --test scripts/tests/provider-requests.test.cjs`

These isolated route tests cover validation, authentication, review field restrictions, decision emails, and SMTP failures. Verify the migration, real storage URLs, SMTP delivery, and concurrent review behavior against a configured staging database before release.

