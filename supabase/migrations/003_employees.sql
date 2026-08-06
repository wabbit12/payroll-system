-- Phase 2: employee master data + RLS
-- Run after 001_profiles.sql

create type public.employment_status as enum (
  'active',
  'inactive',
  'on_leave',
  'terminated'
);

create type public.pay_type as enum (
  'salary',
  'hourly'
);

create type public.pay_frequency as enum (
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly'
);

-- Helper for RLS (security definer avoids recursive policy checks).
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_hr_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in ('hr_admin', 'super_admin'),
    false
  );
$$;

create or replace function public.is_payroll_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in (
      'payroll_admin',
      'hr_admin',
      'super_admin'
    ),
    false
  );
$$;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  employee_number text unique,
  full_name text not null,
  email text not null,
  job_title text,
  department text,
  hire_date date,
  status public.employment_status not null default 'active',
  pay_type public.pay_type not null default 'salary',
  -- Stored as numeric for payroll calc; access controlled by RLS.
  pay_rate numeric(12, 2) not null check (pay_rate >= 0),
  pay_frequency public.pay_frequency not null default 'monthly',
  -- App-level AES-GCM ciphertext (never store plaintext).
  tax_id_encrypted text,
  bank_account_encrypted text,
  bank_routing_encrypted text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employees_status_idx on public.employees (status);
create index employees_email_idx on public.employees (email);

create or replace function public.set_employees_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_employees_updated_at();

alter table public.employees enable row level security;

-- Employees: own record only (no encrypted field exposure beyond what select returns —
-- app should mask; RLS still blocks other rows).
create policy "Employees can view own employee record"
  on public.employees
  for select
  using (user_id = auth.uid());

-- HR / payroll / super: read all
create policy "HR and payroll can view employees"
  on public.employees
  for select
  using (public.is_payroll_or_above());

-- HR / super: insert
create policy "HR can insert employees"
  on public.employees
  for insert
  with check (public.is_hr_or_above());

-- HR / super: update
create policy "HR can update employees"
  on public.employees
  for update
  using (public.is_hr_or_above())
  with check (public.is_hr_or_above());

-- HR / super: delete (soft-delete via status preferred; hard delete allowed for cleanup)
create policy "HR can delete employees"
  on public.employees
  for delete
  using (public.is_hr_or_above());
