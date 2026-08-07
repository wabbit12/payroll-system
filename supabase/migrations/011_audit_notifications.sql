-- Phase 8: audit logs + in-app notifications
-- Run after 010_payments.sql

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Audit: staff can read; anyone authenticated can insert their own actor row
create policy "Payroll staff can view audit logs"
  on public.audit_logs for select
  using (public.is_payroll_or_above() or public.is_hr_or_above());

create policy "Users can insert own audit rows"
  on public.audit_logs for insert
  with check (actor_id = auth.uid());

-- Notifications: own only
create policy "Users can view own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts for other users (e.g. notify employee) need elevated path;
-- app uses service role for cross-user notification inserts.
create policy "Payroll admin can insert notifications"
  on public.notifications for insert
  with check (public.is_payroll_admin() or user_id = auth.uid());
