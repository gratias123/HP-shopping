-- ============================================================================
-- HP COLLECTION — Carnet d'adresses client (Supabase / PostgreSQL)
--
-- Migration rédigée pour la cible Supabase, non exécutée dans cet environnement.
-- Le runtime local utilise server/src/db/migrations/004_customer_addresses.sql.
-- ============================================================================

create table public.customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text not null default '',
  first_name  text not null,
  last_name   text not null,
  line1       text not null,
  line2       text not null default '',
  postal_code text not null,
  city        text not null,
  country     text not null check (length(country) = 2),
  phone       text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index customer_addresses_user_idx
  on public.customer_addresses (user_id, is_default desc, updated_at desc);

create unique index customer_addresses_one_default_idx
  on public.customer_addresses (user_id)
  where is_default = true;

create trigger customer_addresses_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;

grant select, insert, update, delete on public.customer_addresses to authenticated;

create policy customer_addresses_read_self on public.customer_addresses
  for select to authenticated
  using (user_id = auth.uid());

create policy customer_addresses_insert_self on public.customer_addresses
  for insert to authenticated
  with check (user_id = auth.uid());

create policy customer_addresses_update_self on public.customer_addresses
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy customer_addresses_delete_self on public.customer_addresses
  for delete to authenticated
  using (user_id = auth.uid());
