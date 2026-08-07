-- Phase 9: PH statutory deduction columns on pay run lines
-- Run after 011_audit_notifications.sql

alter table public.pay_run_lines
  add column if not exists sss_employee numeric(12, 2) not null default 0,
  add column if not exists philhealth_employee numeric(12, 2) not null default 0,
  add column if not exists pagibig_employee numeric(12, 2) not null default 0,
  add column if not exists monthly_compensation numeric(12, 2);

comment on column public.pay_run_lines.tax_amount is
  'BIR withholding tax (employee) for the period; formerly flat tax %.';
comment on column public.pay_run_lines.other_deductions is
  'Sum of SSS + PhilHealth + Pag-IBIG employee shares (and any misc).';
comment on column public.pay_run_lines.sss_employee is
  'SSS employee share for this period';
comment on column public.pay_run_lines.philhealth_employee is
  'PhilHealth employee share for this period';
comment on column public.pay_run_lines.pagibig_employee is
  'Pag-IBIG (HDMF) employee share for this period';
comment on column public.pay_runs.tax_rate is
  'Legacy flat tax %; unused when PH statutory engine is active (kept for old runs).';
