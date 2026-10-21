-- Persistência do estado da sala (reconexão e recarregar a TV).
-- O tempo real em si usa Supabase Realtime Broadcast (sem tabelas extras).
create table if not exists public.rooms (
  code text primary key check (char_length(code) = 4),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
for each row execute function public.touch_updated_at();

alter table public.rooms enable row level security;

-- Party game casual: acesso anônimo por código de sala. Endureça se publicar em produção.
create policy "rooms_read" on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (true);
create policy "rooms_update" on public.rooms for update using (true);
