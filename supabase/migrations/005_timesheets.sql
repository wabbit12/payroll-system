-- Phase 3: timesheets + entries + RLS
-- Run after 003_employees.sql and 004_employee_self_link.sql

create type public.timesheet_status as enum (
  'draft',
  'submitted',
  'approved',
  'rejected'
);

create type public.timesheet_entry_type as enum (
  'regular',
  'overtime',
  'unpaid_leave'
);

create or replace function public.is_manager_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in (
      'manager',
      'hr_admin',
      'payroll_admin',
      'super_admin'
    ),
    false
  );
$$;

create or replace function public.owns_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.user_id = auth.uid()
  );
$$;

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status public.timesheet_status not null default 'draft',
  employee_note text,
  review_note text,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timesheets_period_valid check (period_end >= period_start),
  constraint timesheets_unique_period unique (employee_id, period_start, period_end)
);

create index timesheets_employee_idx on public.timesheets (employee_id);
create index timesheets_status_idx on public.timesheets (status);

create table public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  work_date date not null,
  hours numeric(5, 2) not null check (hours >= 0 and hours <= 24),
  entry_type public.timesheet_entry_type not null default 'regular',
  notes text,
  created_at timestamptz not null default now(),
  constraint timesheet_entries_unique_day_type unique (timesheet_id, work_date, entry_type)
);

create index timesheet_entries_timesheet_idx on public.timesheet_entries (timesheet_id);

create or replace function public.set_timesheets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger timesheets_set_updated_at
  before update on public.timesheets
  for each row execute function public.set_timesheets_updated_at();

alter table public.timesheets enable row level security;
alter table public.timesheet_entries enable row level security;

-- Timesheets policies
create policy "Employees can view own timesheets"
  on public.timesheets for select
  using (public.owns_employee(employee_id));

create policy "Managers can view all timesheets"
  on public.timesheets for select
  using (public.is_manager_or_above());

create policy "Employees can create own draft timesheets"
  on public.timesheets for insert
  with check (
    public.owns_employee(employee_id)
    and status = 'draft'
  );

create policy "Employees can update own draft or rejected timesheets"
  on public.timesheets for update
  using (
    public.owns_employee(employee_id)
    and status in ('draft', 'rejected')
  )
  with check (public.owns_employee(employee_id));

create policy "Managers can review submitted timesheets"
  on public.timesheets for update
  using (
    public.is_manager_or_above()
    and status = 'submitted'
  )
  with check (public.is_manager_or_above());

create policy "Employees can delete own draft timesheets"
  on public.timesheets for delete
  using (
    public.owns_employee(employee_id)
    and status = 'draft'
  );

-- Entries policies (via parent timesheet)
create policy "Employees can view own timesheet entries"
  on public.timesheet_entries for select
  using (
    exists (
      select 1 from public.timesheets t
      where t.id = timesheet_id
        and public.owns_employee(t.employee_id)
    )
  );

create policy "Managers can view all timesheet entries"
  on public.timesheet_entries for select
  using (public.is_manager_or_above());

create policy "Employees can insert entries on editable timesheets"
  on public.timesheet_entries for insert
  with check (
    exists (
      select 1 from public.timesheets t
      where t.id = timesheet_id
        and public.owns_employee(t.employee_id)
        and t.status in ('draft', 'rejected')
    )
  );

create policy "Employees can update entries on editable timesheets"
  on public.timesheet_entries for update
  using (
    exists (
      select 1 from public.timesheets t
      where t.id = timesheet_id
        and public.owns_employee(t.employee_id)
        and t.status in ('draft', 'rejected')
    )
  )
  with check (
    exists (
      select 1 from public.timesheets t
      where t.id = timesheet_id
        and public.owns_employee(t.employee_id)
        and t.status in ('draft', 'rejected')
    )
  );

create policy "Employees can delete entries on editable timesheets"
  on public.timesheet_entries for delete
  using (
    exists (
      select 1 from public.timesheets t
      where t.id = timesheet_id
        and public.owns_employee(t.employee_id)
        and t.status in ('draft', 'rejected')
    )
  );
