# 🐾 Animal-Backend Project — Complete Analysis

## Tech Stack Overview
- **Framework**: Next.js 13 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Admin Panel**: Built-in `/dashboard` — same codebase as the API
- **Mobile API**: REST APIs under `/app/api/v1/` — consumed by mobile app
- **Auth**: Supabase Auth + custom JWT
- **Payment**: PayFast Gateway
- **Email**: ZeptoMail (SMTP)
- **Deployment**: Vercel

---

## 📁 Complete Folder Structure

```
animal-backend/
├── .env                        ← 🔑 All environment variables (Supabase, PayFast, SMTP, Google)
├── .env.example                ← Template for new developers
├── app/                        ← Next.js App Router (pages + API)
│   ├── (auth)/                 ← Login/Signup pages for Admin Panel
│   ├── (public)/               ← Publicly accessible pages
│   ├── api/
│   │   ├── auth/               ← Auth endpoints (login, register, verify, etc.)
│   │   ├── places/             ← Places-related auth/public endpoints
│   │   └── v1/                 ← 📱 ALL MOBILE APP APIs live here
│   │       ├── analytics/
│   │       ├── animal-types/
│   │       ├── audit-logs/
│   │       ├── auth/
│   │       ├── boost-packages/
│   │       ├── boosted/
│   │       ├── breeders/
│   │       ├── breeds/
│   │       ├── community/
│   │       ├── cron/
│   │       ├── donations/
│   │       ├── event-categories/
│   │       ├── event-reminder/
│   │       ├── events/
│   │       ├── groups/
│   │       ├── locations/
│   │       ├── notifications/
│   │       ├── payments/
│   │       ├── places/
│   │       ├── provider-requests/
│   │       ├── rescue-centres/
│   │       ├── reviews/
│   │       ├── role-access/
│   │       ├── roles/
│   │       ├── search/
│   │       ├── service-categories/
│   │       ├── service-providers/
│   │       ├── signup-roles/
│   │       ├── subscriptions/
│   │       ├── support/
│   │       ├── upload-image/
│   │       ├── upload-url/
│   │       ├── users/
│   │       └── whats-new/
│   ├── dashboard/              ← 🖥️ Admin Panel UI lives here (same codebase)
│   │   ├── users/
│   │   ├── breeders/
│   │   ├── veterinarians/
│   │   ├── service-providers/
│   │   ├── pet-friendly-places/
│   │   ├── events/
│   │   ├── community/
│   │   ├── payments-billing/
│   │   ├── transactions/
│   │   ├── analytics/
│   │   ├── roles/
│   │   ├── support/
│   │   ├── donations/
│   │   └── ... (27 sections total)
│   ├── privacy/
│   ├── support/
│   └── terms/
├── components/                 ← Reusable UI components (tables, modals, charts)
├── database/
│   ├── all_migrations.sql      ← Combined SQL of all migrations
│   └── migrations/             ← 54 individual migration files (001 → 052)
├── hooks/                      ← Custom React hooks
├── lib/                        ← Shared backend utilities
│   ├── supabase.ts             ← Client-side Supabase client (uses anon key)
│   ├── supabase-server.ts      ← Server-side Supabase client (uses service role key)
│   ├── server-supabase.ts      ← Admin Supabase client (supabaseAdmin)
│   ├── db.ts                   ← MySQL connection (legacy, not primary)
│   ├── auth-server.ts          ← Auth helpers (roles, permissions)
│   ├── auth-profile.ts
│   ├── jwt.ts
│   ├── permissions.ts          ← All permission constants
│   ├── email-service.ts
│   ├── image-upload.ts
│   ├── payfast.ts
│   └── ... (26 files total)
├── providers/                  ← React context providers
├── scripts/                    ← One-time seed scripts (e.g., seed-roles.js)
├── docs/                       ← Documentation
├── API_COLLECTION.md           ← Full API reference for mobile team
├── vercel.json                 ← Vercel deployment config
└── package.json
```

---

## 📱 How Mobile App APIs Work & How Changes Affect Admin Panel

### The Key Insight: **Everything shares the same database**

```
Mobile App  →  calls  →  /app/api/v1/**  →  reads/writes  →  Supabase DB
                                                                    ↑
Admin Panel →  calls  →  /app/dashboard/** →  reads/writes  →  Supabase DB (same!)
```

### When you change a Mobile API:

| Change Type | Impact on Admin Panel |
|---|---|
| Add a new field to API response | ✅ No impact — admin panel reads from DB directly |
| Remove a field from API response | ✅ No impact on panel, but mobile app breaks |
| Add a new DB column (via migration) | Admin panel can now show/use that column too |
| Change business logic in an endpoint | Admin panel unaffected (it uses its own endpoints) |
| Change auth/permission logic | ⚠️ Could affect both — they share `lib/auth-server.ts` |
| Change DB table structure | ⚠️ Both mobile API + admin panel affected |

### Example: Add a new field to `/app/api/v1/users/`

1. Add column in DB → write new migration SQL file in `database/migrations/`
2. Update the API route in `/app/api/v1/users/route.ts` to return the new field
3. Mobile app receives the new field
4. Admin panel's `/dashboard/users/` page — you may also need to add the column to the table UI in `app/dashboard/users/`

---

## 🗄️ Database Changes & Live Database Impact

### How Migrations Work in THIS Project

> ⚠️ **This project does NOT use an automated migration runner** (no Prisma, no Supabase CLI push configured). Migrations are **manual SQL files** that must be executed manually in Supabase.

### Migration Workflow:

```
1. Write new SQL file
   database/migrations/053_your_change.sql

2. Test locally
   → Go to your LOCAL Supabase dashboard
   → SQL Editor → paste and run the SQL
   → Verify it works

3. Deploy to LIVE
   → Go to LIVE Supabase dashboard (ndqrrdhjqrhudydnuipd)
   → SQL Editor → paste and run the same SQL
   → This directly modifies the LIVE database — be careful!

4. Also update the combined file
   database/all_migrations.sql  ← append your new migration here
```

### ⚠️ Does a DB change affect the live database immediately?

**YES — immediately and directly.** There is no staging buffer. If you run SQL on the live Supabase project, it changes live data right away.

**Safe practices:**
- Always test on LOCAL Supabase first
- Use `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` in SQL (this project already does this ✅)
- For destructive changes (DROP, DELETE), take a backup first from Supabase Dashboard → Settings → Database → Backups
- Use `ADD COLUMN` rather than `MODIFY COLUMN` when possible

---

## 🔄 How to Change Supabase Account (Full Guide)

### Step 1 — Create New Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Note down the new project's:
   - **Project URL**: `https://XXXXXXXX.supabase.co`
   - **Anon Key** (public): from Settings → API
   - **Service Role Key** (secret): from Settings → API

### Step 2 — Update `.env` File

```bash
# In /Users/apple/Desktop/Projects/animal-backend/.env
# Comment out old keys, add new ones:

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=YOUR_NEW_ANON_KEY
SUPABASE_PUBLIC_URL=https://YOUR_NEW_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_NEW_SERVICE_ROLE_KEY
```

> All 3 Supabase client files read from these env vars automatically:
> - `lib/supabase.ts` → uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_KEY`
> - `lib/supabase-server.ts` → uses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
> - `lib/server-supabase.ts` → uses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

**No code changes needed** — only `.env` changes!

### Step 3 — Migrate Database Schema to New Supabase

```sql
-- Go to new Supabase Dashboard → SQL Editor
-- Run the complete migration file:
-- database/all_migrations.sql  (contains ALL 52 migrations combined)
```

This will create all tables, RLS policies, indexes, and seed data in the new project.

### Step 4 — Migrate Data (if needed)

If you want to copy existing DATA (rows) from old to new Supabase:

**Option A — Supabase Dashboard Export**
1. Old Supabase → Settings → Database → Backups → Download backup
2. New Supabase → SQL Editor → restore the backup

**Option B — pg_dump (programmatic)**
```bash
# Export from old DB
pg_dump "postgresql://postgres:[OLD_DB_PASSWORD]@db.ndqrrdhjqrhudydnuipd.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  -f data_backup.sql

# Import to new DB
psql "postgresql://postgres:[NEW_DB_PASSWORD]@db.YOUR_NEW_PROJECT.supabase.co:5432/postgres" \
  < data_backup.sql
```

### Step 5 — Migrate Storage Buckets

Storage files (images etc.) are stored in Supabase Storage, NOT in the database. These need to be copied separately:
1. Old Supabase → Storage → Download files or use Supabase Storage API to list and re-upload
2. The storage bucket name used is `animalclickposts` (from migration 016)

### Step 6 — Update Vercel Environment Variables

If deployed to Vercel, update the env vars there too:
- Vercel Dashboard → Your Project → Settings → Environment Variables
- Update the 4 Supabase variables to point to the new project

### Step 7 — Re-run Seed Script (if needed)

```bash
npm run seed:roles
# This re-seeds roles and permissions data into the new DB
```

---

## 🌍 Local vs Live Supabase — Current Setup

| | Local (Active) | Live |
|---|---|---|
| **URL** | `yvbynxceonzlhfhtewcr.supabase.co` | `ndqrrdhjqrhudydnuipd.supabase.co` |
| **Status in .env** | ✅ Active (uncommented) | 🔕 Commented out |
| **PayFast** | Sandbox mode | Real payments |

To **switch to live**, simply swap the commented/uncommented lines in `.env`.

---

## 🔑 All Files That Need Updating When Changing Supabase

| File | What Changes |
|---|---|
| `.env` | Update 4 Supabase env vars |
| `vercel.json` / Vercel Dashboard | Update env vars in deployment |
| No code files need changing | ✅ All clients read from env vars |

