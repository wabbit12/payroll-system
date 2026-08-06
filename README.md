# Payroll Management

Next.js + TypeScript + Supabase starter for a secure payroll web app.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind)
- **Supabase** (Postgres, Auth, MFA)
- **Vercel** (recommended hosting)

## Setup

### 1. Install dependencies

```powershell
cd D:\Codebase\payroll-management
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **Project Settings → API**
3. Copy **Project URL** (`https://xxxx.supabase.co`), **publishable** key, and **secret** key

### 3. Env vars

```powershell
copy .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

### 4. Run SQL

In Supabase → **SQL Editor**, run:

1. `supabase/migrations/001_profiles.sql`
2. Optionally promote yourself with `supabase/migrations/002_promote_role.sql` (edit the email first)

### 5. Auth URLs

**Authentication → URL Configuration**

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`

### 6. MFA (admins)

**Authentication → Multi-Factor** → enable **TOTP**

### 7. Start

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 1 checklist

- [x] Login / signup / sign out
- [x] Password reset (`/forgot-password`)
- [x] Roles on `profiles` + route guards (`/manager`, `/hr`, `/payroll`, `/admin`)
- [x] Login rate limit (5 / 15 min per IP+email)
- [x] MFA enroll (`/mfa`) + verify after login (`/mfa/verify`)

### Test role access

1. Sign up / sign in
2. Run promote SQL to set `super_admin`
3. Refresh dashboard — Admin / HR / Payroll / Manager links should work
4. Set role back to `employee` — those links should be blocked
5. As admin, open `/mfa` and enroll an authenticator

## Phase 2 — Employee records

1. Run `supabase/migrations/003_employees.sql` in the SQL Editor
2. Add encryption key to `.env.local`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
FIELD_ENCRYPTION_KEY=paste_hex_here
```

3. Restart `npm run dev`
4. As `hr_admin` or `super_admin`, open **HR / Employees** → Add employee
5. As the employee login (same email), open **My profile** — only their record shows

Bank / tax IDs are AES-GCM encrypted before save; UI shows masked values only.

## Phase 3 — Timesheets

1. Run `supabase/migrations/005_timesheets.sql` in the SQL Editor
2. Promote a user to `manager` (or use `super_admin`) via `002_promote_role.sql`
3. As a linked employee: **My timesheets** → New → add hours → Submit
4. As manager: **Manager approvals** → Approve or Reject

Only `approved` timesheets should be used in Phase 4 pay runs.

## What's next

Phase 4 — Pay run engine (gross → deductions → net)
