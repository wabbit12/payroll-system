-- Phase 4: pay runs + line items + RLS
-- Run after 005_timesheets.sql

create type public.pay_run_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'locked'
);

create or replace function public.is_payroll_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in ('payroll_admin', 'super_admin'),
    false
  );
$$;

create table public.pay_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status public.pay_run_status not null default 'draft',
  -- Snapshot of simplified statutory rate used when calculated (e.g. 0.10 = 10%).
  tax_rate numeric(6, 4) not null default 0.1000
    check (tax_rate >= 0 and tax_rate <= 1),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  calculated_at timestamptz,
  constraint pay_runs_period_valid check (period_end >= period_start)
);

create index pay_runs_period_idx on public.pay_runs (period_start, period_end);
create index pay_runs_status_idx on public.pay_runs (status);

create table public.pay_run_lines (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references public.pay_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  employee_name text not null,
  pay_type public.pay_type not null,
  pay_rate numeric(12, 2) not null,
  regular_hours numeric(8, 2) not null default 0,
  overtime_hours numeric(8, 2) not null default 0,
  regular_pay numeric(12, 2) not null default 0,
  overtime_pay numeric(12, 2) not null default 0,
  gross_pay numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  other_deductions numeric(12, 2) not null default 0,
  net_pay numeric(12, 2) not null default 0,
  calc_note text,
  created_at timestamptz not null default now(),
  constraint pay_run_lines_unique_employee unique (pay_run_id, employee_id)
);

create index pay_run_lines_run_idx on public.pay_run_lines (pay_run_id);
create index pay_run_lines_employee_idx on public.pay_run_lines (employee_id);

create table public.pay_run_line_timesheets (
  pay_run_line_id uuid not null references public.pay_run_lines (id) on delete cascade,
  timesheet_id uuid not null references public.timesheets (id) on delete restrict,
  primary key (pay_run_line_id, timesheet_id)
);

create or replace function public.set_pay_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pay_runs_set_updated_at
  before update on public.pay_runs
  for each row execute function public.set_pay_runs_updated_at();

alter table public.pay_runs enable row level security;
alter table public.pay_run_lines enable row level security;
alter table public.pay_run_line_timesheets enable row level security;

-- Pay runs: payroll/hr/super read; payroll/super write
create policy "Payroll staff can view pay runs"
  on public.pay_runs for select
  using (public.is_payroll_or_above());

create policy "Payroll admin can insert pay runs"
  on public.pay_runs for insert
  with check (public.is_payroll_admin());

create policy "Payroll admin can update draft pay runs"
  on public.pay_runs for update
  using (public.is_payroll_admin())
  with check (public.is_payroll_admin());

create policy "Payroll admin can delete draft pay runs"
  on public.pay_runs for delete
  using (public.is_payroll_admin() and status = 'draft');

-- Lines
create policy "Payroll staff can view pay run lines"
  on public.pay_run_lines for select
  using (public.is_payroll_or_above());

create policy "Payroll admin can insert pay run lines"
  on public.pay_run_lines for insert
  with check (public.is_payroll_admin());

create policy "Payroll admin can update pay run lines"
  on public.pay_run_lines for update
  using (public.is_payroll_admin())
  with check (public.is_payroll_admin());

create policy "Payroll admin can delete pay run lines"
  on public.pay_run_lines for delete
  using (public.is_payroll_admin());

-- Line ↔ timesheet links
create policy "Payroll staff can view line timesheets"
  on public.pay_run_line_timesheets for select
  using (public.is_payroll_or_above());

create policy "Payroll admin can insert line timesheets"
  on public.pay_run_line_timesheets for insert
  with check (public.is_payroll_admin());

create policy "Payroll admin can delete line timesheets"
  on public.pay_run_line_timesheets for delete
  using (public.is_payroll_admin());
