-- Phase 5a: add rejected status (must be committed before use in later SQL)
-- Run this alone first, then run 008_pay_run_approval_guards.sql

alter type public.pay_run_status add value if not exists 'rejected';
