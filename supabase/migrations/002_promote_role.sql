-- Phase 1 helpers. Run in Supabase SQL Editor after 001_profiles.sql.
-- Promote your own account for local testing (replace the email).

update public.profiles
set role = 'super_admin'
where id = (
  select id from auth.users where email = 'you@example.com'
);

-- Other roles to try:
-- 'employee' | 'manager' | 'hr_admin' | 'payroll_admin' | 'super_admin'

-- Enable MFA in dashboard: Authentication → Multi-Factor → enable TOTP
