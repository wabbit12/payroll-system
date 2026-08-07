-- Phase 7: simulated payment status (PH MVP — no live bank rails)
-- Run after 009_payslips.sql

create type public.payment_status as enum (
  'unpaid',
  'pending',
  'paid',
  'failed'
);

alter table public.pay_runs
  add column if not exists payment_status public.payment_status not null default 'unpaid',
  add column if not exists payment_provider text not null default 'simulated',
  add column if not exists payment_reference text,
  add column if not exists payment_note text,
  add column if not exists payment_started_at timestamptz,
  add column if not exists payment_completed_at timestamptz,
  add column if not exists payment_by uuid references auth.users (id) on delete set null;

create index if not exists pay_runs_payment_status_idx
  on public.pay_runs (payment_status);
