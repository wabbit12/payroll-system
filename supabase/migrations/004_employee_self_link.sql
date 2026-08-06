-- Allow an employee to claim an unlinked HR record that matches their login email.

create policy "Employees can view unlinked record by email"
  on public.employees
  for select
  using (
    user_id is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "Employees can link unlinked record by email"
  on public.employees
  for update
  using (
    user_id is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (user_id = auth.uid());
