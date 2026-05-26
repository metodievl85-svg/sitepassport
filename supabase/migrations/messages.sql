create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.profiles(id) on delete cascade,
  worker_id uuid not null,
  message_text text,
  file_url text,
  file_type text,
  file_name text,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.messages enable row level security;

create policy "Users can read their own messages"
  on public.messages
  for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages as themselves"
  on public.messages
  for insert
  with check (auth.uid() = sender_id);

create index if not exists messages_receiver_sent_idx
  on public.messages (receiver_id, sent_at desc);
