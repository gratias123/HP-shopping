-- ============================================================================
-- HP COLLECTION — schéma de production Supabase / PostgreSQL
--
-- Ce fichier est le miroir PostgreSQL du schéma local SQLite
-- (server/src/db/migrations/001_init.sql), adapté à Supabase Auth :
--   * les comptes vivent dans auth.users ;
--   * les données publiques (profil, rôle, téléphone) vivent dans public.profiles ;
--   * aucun mot de passe ni jeton de session n'est stocké dans public.
--
-- Il n'a pas été exécuté contre un projet Supabase réel dans le cadre de ce
-- dépôt. Voir README > « Base de données de production » avant toute mise en
-- ligne : le connecteur applicatif Supabase n'est pas encore branché.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Rôles et permissions -------------------------------------------------------
create table public.roles (
  slug  text primary key,
  label text not null
);

create table public.role_permissions (
  role_slug  text not null references public.roles(slug) on delete cascade,
  permission text not null,
  primary key (role_slug, permission)
);

insert into public.roles (slug, label) values
  ('customer', 'Client'),
  ('staff', 'Équipe boutique'),
  ('admin', 'Administrateur');

insert into public.role_permissions (role_slug, permission) values
  ('admin', 'catalog:read'), ('admin', 'catalog:write'),
  ('admin', 'orders:read'), ('admin', 'orders:write'),
  ('admin', 'promos:write'), ('admin', 'shipping:write'),
  ('admin', 'settings:write'), ('admin', 'users:read'),
  ('admin', 'messages:read'),
  ('staff', 'catalog:read'), ('staff', 'catalog:write'),
  ('staff', 'orders:read'), ('staff', 'orders:write'),
  ('staff', 'promos:write'), ('staff', 'shipping:write'),
  ('staff', 'messages:read');

-- Profils --------------------------------------------------------------------
-- id est celui de auth.users : la création est automatisée par le trigger
-- handle_new_user() défini dans la migration des fonctions.
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      citext not null unique,
  full_name  text not null default '',
  phone      text,
  role_slug  text not null default 'customer' references public.roles(slug),
  status     text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Catalogue ------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  image_url   text,
  image_alt   text,
  parent_id   uuid references public.categories(id) on delete set null,
  sort_order  integer not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index categories_public_idx on public.categories (published, sort_order);

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  slug              text not null unique,
  name              text not null,
  short_description text not null default '',
  description       text not null default '',
  composition       text,
  care              text,
  category_id       uuid not null references public.categories(id) on delete restrict,
  price_cents       integer not null check (price_cents >= 0),
  sale_price_cents  integer check (
    sale_price_cents is null or (sale_price_cents >= 0 and sale_price_cents <= price_cents)
  ),
  sale_starts_at    timestamptz,
  sale_ends_at      timestamptz,
  status            text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured       boolean not null default false,
  low_stock_alert   integer check (low_stock_alert is null or low_stock_alert >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (sale_ends_at is null or sale_starts_at is null or sale_ends_at >= sale_starts_at)
);
create index products_status_idx on public.products (status, created_at desc);
create index products_category_idx on public.products (category_id, status);
create index products_name_idx on public.products (name);

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku        text not null unique,
  size       text not null,
  color      text not null,
  color_hex  text check (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$'),
  stock      integer not null default 0 check (stock >= 0),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.wishlists (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- Promotions -----------------------------------------------------------------
create table public.promo_codes (
  id                     uuid primary key default gen_random_uuid(),
  code                   citext not null unique,
  description            text not null default '',
  type                   text not null check (type in ('percent', 'fixed')),
  value                  integer not null check (value > 0 and (type <> 'percent' or value <= 10000)),
  min_subtotal_cents     integer not null default 0 check (min_subtotal_cents >= 0),
  starts_at              timestamptz,
  ends_at                timestamptz,
  max_uses               integer check (max_uses is null or max_uses > 0),
  max_uses_per_customer  integer check (max_uses_per_customer is null or max_uses_per_customer > 0),
  used_count             integer not null default 0 check (used_count >= 0),
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

-- Livraison ------------------------------------------------------------------
create table public.shipping_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  countries  text not null,
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_methods (
  id              uuid primary key default gen_random_uuid(),
  zone_id         uuid not null references public.shipping_zones(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  price_cents     integer not null check (price_cents >= 0),
  free_over_cents integer check (free_over_cents is null or free_over_cents >= 0),
  min_days        integer check (min_days is null or min_days >= 0),
  max_days        integer check (max_days is null or max_days >= 0),
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (max_days is null or min_days is null or max_days >= min_days)
);
create index shipping_methods_zone_idx on public.shipping_methods (zone_id);

-- Commandes ------------------------------------------------------------------
create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  user_id               uuid references public.profiles(id) on delete set null,
  email                 citext not null,
  phone                 text not null default '',
  status                text not null default 'pending' check (status in (
                          'pending', 'confirmed', 'preparing', 'shipped',
                          'delivered', 'cancelled', 'refunded'
                        )),
  payment_method        text not null check (payment_method in ('cod', 'mobile_money')),
  payment_status        text not null default 'pending' check (payment_status in (
                          'pending', 'paid', 'failed', 'refunded'
                        )),
  subtotal_cents        integer not null check (subtotal_cents >= 0),
  discount_cents        integer not null default 0 check (discount_cents >= 0),
  shipping_cents        integer not null default 0 check (shipping_cents >= 0),
  total_cents           integer not null check (total_cents >= 0),
  currency              text not null default 'XOF',
  promo_code            text,
  promo_id              uuid references public.promo_codes(id) on delete set null,
  shipping_first_name   text not null,
  shipping_last_name    text not null,
  shipping_line1        text not null,
  shipping_line2        text not null default '',
  shipping_postal_code  text not null,
  shipping_city         text not null,
  shipping_country      text not null,
  shipping_zone_id      uuid,
  shipping_method_id    uuid,
  shipping_method_label text not null default '',
  customer_note         text not null default '',
  internal_note         text not null default '',
  stock_released        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (total_cents = subtotal_cents - discount_cents + shipping_cents)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_email_idx on public.orders (email, created_at desc);
create index orders_created_idx on public.orders (created_at desc);

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  variant_id        uuid references public.product_variants(id) on delete set null,
  product_name      text not null,
  product_reference text not null,
  variant_size      text not null default '',
  variant_color     text not null default '',
  image_url         text,
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  quantity          integer not null check (quantity > 0),
  line_total_cents  integer not null check (line_total_cents = unit_price_cents * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  note          text not null default '',
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label   text not null default '',
  created_at    timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  provider           text not null,
  provider_reference text,
  amount_cents       integer not null check (amount_cents >= 0),
  currency           text not null,
  status             text not null check (status in ('pending', 'authorized', 'paid', 'failed', 'refunded')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index payments_provider_ref_idx on public.payments (provider, provider_reference)
  where provider_reference is not null;
create index payments_order_idx on public.payments (order_id);

create table public.promo_redemptions (
  id         uuid primary key default gen_random_uuid(),
  promo_id   uuid not null references public.promo_codes(id) on delete cascade,
  order_id   uuid not null references public.orders(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  email      citext not null,
  created_at timestamptz not null default now(),
  unique (promo_id, order_id)
);
create index promo_redemptions_email_idx on public.promo_redemptions (promo_id, email);

create table public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  payload_hash text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

-- Divers ---------------------------------------------------------------------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  email      citext not null,
  subject    text not null check (char_length(subject) between 1 and 160),
  message    text not null check (char_length(message) between 1 and 3000),
  status     text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

create table public.settings (
  key        text primary key,
  value      text not null,
  is_public  boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action        text not null,
  entity        text not null,
  entity_id     text,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Horodatage automatique -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger promo_codes_updated_at before update on public.promo_codes
  for each row execute function public.set_updated_at();
create trigger shipping_zones_updated_at before update on public.shipping_zones
  for each row execute function public.set_updated_at();
create trigger shipping_methods_updated_at before update on public.shipping_methods
  for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
