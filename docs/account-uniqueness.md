# Duplicate account prevention

App signup (`POST /api/v1/auth/signup`), legacy app signup
(`POST /api/auth/signup`) and administrative creation (`POST /api/v1/users`)
trim email addresses and convert them to lowercase before checking or storing
them. Existing mixed-case emails match the same account. Repeated creation
returns HTTP 409 with `An account with this email address already exists`.
Names are not account identifiers; people can share a name.

Availability lookup errors stop creation instead of assuming no account exists.
Auth duplicate errors do not trigger a second signup attempt. Database unique
constraint failures are also returned as conflicts. Supabase's concealed
existing-user response (an empty identities array) is not treated as a newly
created account. Signup profile recovery only uses the new Auth identity's ID,
never a different account found by email. The generated `user_name` column is
not included in profile writes.

Migration 063 adds a unique index over `lower(btrim(email))` to protect direct
Supabase profile writes and concurrent requests. Existing normalized duplicate
groups must be reviewed before applying it; the migration intentionally fails
rather than deleting or merging accounts. It does not change the legacy MySQL
schema. That database also needs a unique email constraint to arbitrate
simultaneous direct writes.

Verification: `node --test scripts/tests/account-creation.test.cjs`.
