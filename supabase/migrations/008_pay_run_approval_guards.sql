-- Phase 5b: approval columns + immutability guards
-- Run AFTER 007_pay_run_approval.sql has succeeded (separate query / commit).

alter table public.pay_runs
  add column if not exists submitted_by uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users (id) on delete set null;

create or replace function public.pay_run_is_editable(p_pay_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pay_runs pr
    where pr.id = p_pay_run_id
      and pr.status in ('draft', 'rejected')
  );
$$;

create or replace function public.enforce_pay_run_line_mutable()
returns trigger
language plpgsql
as $$
declare
  run_id uuid;
begin
  run_id := coalesce(new.pay_run_id, old.pay_run_id);
  if not public.pay_run_is_editable(run_id) then
    raise exception 'Pay run lines cannot be changed unless status is draft or rejected';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists pay_run_lines_mutable on public.pay_run_lines;
create trigger pay_run_lines_mutable
  before insert or update or delete on public.pay_run_lines
  for each row execute function public.enforce_pay_run_line_mutable();

create or replace function public.enforce_pay_run_line_timesheets_mutable()
returns trigger
language plpgsql
as $$
declare
  run_id uuid;
begin
  select prl.pay_run_id into run_id
  from public.pay_run_lines prl
  where prl.id = coalesce(new.pay_run_line_id, old.pay_run_line_id);

  if run_id is null or not public.pay_run_is_editable(run_id) then
    raise exception 'Pay run timesheet links cannot be changed unless status is draft or rejected';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists pay_run_line_timesheets_mutable on public.pay_run_line_timesheets;
create trigger pay_run_line_timesheets_mutable
  before insert or update or delete on public.pay_run_line_timesheets
  for each row execute function public.enforce_pay_run_line_timesheets_mutable();
