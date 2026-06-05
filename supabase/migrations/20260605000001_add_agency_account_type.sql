-- Add 'agency' as a valid role value.
-- Drops and recreates the check constraint so it works whether or not one existed before.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('worker', 'company', 'agency'));

-- Agency–worker join table
create table if not exists public.agency_workers (
  id         uuid        primary key default gen_random_uuid(),
  agency_id  uuid        not null references public.profiles(id) on delete cascade,
  worker_id  uuid        not null references public.workers(id) on delete cascade,
  added_at   timestamptz not null default now(),
  unique (agency_id, worker_id)
);

alter table public.agency_workers enable row level security;

create policy "Agencies manage their own rows"
  on public.agency_workers
  for all
  using  (agency_id = auth.uid())
  with check (agency_id = auth.uid());

create index if not exists agency_workers_agency_id_idx
  on public.agency_workers (agency_id);
