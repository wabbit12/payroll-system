-- Phase 6: payslips metadata + private storage bucket
-- Run after 008_pay_run_approval_guards.sql

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references public.pay_runs (id) on delete cascade,
  pay_run_line_id uuid not null references public.pay_run_lines (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  storage_path text not null,
  file_name text not null,
  period_start date not null,
  period_end date not null,
  gross_pay numeric(12, 2) not null,
  tax_amount numeric(12, 2) not null,
  other_deductions numeric(12, 2) not null default 0,
  net_pay numeric(12, 2) not null,
  generated_by uuid references auth.users (id) on delete set null,
  generated_at timestamptz not null default now(),
  constraint payslips_unique_run_employee unique (pay_run_id, employee_id)
);

create index payslips_employee_idx on public.payslips (employee_id);
create index payslips_pay_run_idx on public.payslips (pay_run_id);

alter table public.payslips enable row level security;

create policy "Employees can view own payslips"
  on public.payslips for select
  using (public.owns_employee(employee_id));

create policy "Payroll staff can view payslips"
  on public.payslips for select
  using (public.is_payroll_or_above());

create policy "Payroll admin can insert payslips"
  on public.payslips for insert
  with check (public.is_payroll_admin());

create policy "Payroll admin can update payslips"
  on public.payslips for update
  using (public.is_payroll_admin())
  with check (public.is_payroll_admin());

create policy "Payroll admin can delete payslips"
  on public.payslips for delete
  using (public.is_payroll_admin());

-- Private storage bucket for PDF files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payslips',
  'payslips',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

-- Storage: employees read own folder {employee_id}/...
create policy "Employees can read own payslip files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payslips'
    and exists (
      select 1
      from public.employees e
      where e.user_id = auth.uid()
        and (storage.foldername(name))[1] = e.id::text
    )
  );

create policy "Payroll admin can manage payslip files"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'payslips'
    and public.is_payroll_admin()
  )
  with check (
    bucket_id = 'payslips'
    and public.is_payroll_admin()
  );
