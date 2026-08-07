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

## Phase 4 — Pay runs

1. Run `supabase/migrations/006_pay_runs.sql` in the SQL Editor
2. Use a `payroll_admin` or `super_admin` account
3. Open **Payroll** → **New pay run** → set period + tax % → create
4. Review draft line items (gross / tax / net); use **Recalculate** if needed

Rules (MVP):
- **Salary:** `pay_rate` = amount for this period
- **Hourly:** approved timesheet hours in range; overtime × 1.5
- **Tax:** flat % on gross (placeholder)

## Phase 5 — Pay run approval

1. Run `supabase/migrations/007_pay_run_approval.sql` first (adds `rejected` enum)
2. Then run `supabase/migrations/008_pay_run_approval_guards.sql` (columns + locks)
3. On a draft pay run → **Submit for approval**
4. **Approve** or **Reject** (reject requires a note)
5. On approved → **Lock pay run** (freezes amounts)
6. Unapproved / pending / rejected cannot be marked paid (`canMarkPayRunPaid`)

Flow: `draft` → `pending_approval` → `approved` → `locked` (or `rejected` → fix → resubmit)

## Phase 6 — Payslips

1. Run `supabase/migrations/009_payslips.sql` (creates `payslips` table + private Storage bucket)
2. Approve (or lock) a pay run
3. Click **Generate payslips**
4. Employee opens **My payslips** → **Download PDF**

Email “payslip ready” is deferred (Phase 8 / notifications).

## What's next

Phase 7 — Payment provider + payment status
