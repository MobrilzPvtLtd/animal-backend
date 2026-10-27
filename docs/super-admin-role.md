# Super Admin role consolidation

Approver and Manager are retired. They are excluded from role selection and
authorization, and migration 062 removes their database rows and assignments
without deleting user accounts or promoting them to administrative access.

The Users page derives role options from existing `roles` rows. Owner and Admin
are presented as one Super Admin option, badge and assignment checkbox. The
filter matches either legacy ID; no roles are invented when the database lacks
them. Existing assignments are preserved when editing unrelated roles.

`lib/roles.ts` treats Owner, Admin and Super Admin as aliases. Server role
authorization, management session handling, sidebar access, subscription access
and user deletion protection use this compatibility layer. Super Admin accounts
cannot be deleted through user management. Public signup offers only Guest,
Subscriber and Provider; privileged roles require administrative assignment.

Deploy the application compatibility changes before applying
`supabase/migrations/20240101006100_unify_super_admin_role.sql` through the normal
migration process. The migration reuses the Owner role ID when possible, unions
existing permissions and assignments, preserves entity links and removes the
duplicate role rows transactionally. Conflicting entity links abort the entire
migration rather than silently discarding information. Legacy session metadata
continues to be recognized by the compatibility layer.

The seed script creates Super Admin instead of separate Owner/Admin roles and
preserves custom roles. Run the consolidation migration for existing databases;
seeding alone does not merge legacy assignments.

Validation: `node --test scripts/tests/roles.test.cjs` and TypeScript checks.
