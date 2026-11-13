-- ============================================================================
-- HP COLLECTION — Row Level Security (Supabase / PostgreSQL)
--
-- Principe :
--   * anon : catalogue publié, moyens de livraison actifs, réglages publics,
--            création d'un message de contact et appel de create_order() ;
--   * authenticated : mêmes lectures + profil personnel, favoris, commandes
--            personnelles ; les droits d'administration passent par les
--            permissions stockées en base (has_permission) ;
--   * service_role : accès complet, utilisé par l'API serveur et les scripts.
--
-- Aucune policy d'écriture catalogue n'est accordée aux clients : les
-- mutations passent par l'API protégée ou par service_role.
-- Ces policies n'ont pas été exécutées contre un projet Supabase réel.
-- ============================================================================

-- On retire les droits hérités éventuels avant d'accorder le strict minimum.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all functions in schema public from public;

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.wishlists enable row level security;
alter table public.promo_codes enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.webhook_events enable row level security;
alter table public.contact_messages enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

-- Rôles et permissions -------------------------------------------------------
grant select on public.roles, public.role_permissions to anon, authenticated;
create policy roles_read on public.roles
  for select to anon, authenticated using (true);
create policy role_permissions_read on public.role_permissions
  for select to anon, authenticated using (true);

-- Profils --------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('users:read'));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Catalogue ------------------------------------------------------------------
grant select on public.categories, public.products, public.product_images,
  public.product_variants to anon, authenticated;

create policy categories_read_public on public.categories
  for select to anon, authenticated
  using (published = true);
create policy categories_read_staff on public.categories
  for select to authenticated
  using (public.has_permission('catalog:read'));

create policy products_read_public on public.products
  for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.categories c
       where c.id = products.category_id and c.published = true
    )
  );
create policy products_read_staff on public.products
  for select to authenticated
  using (public.has_permission('catalog:read'));

create policy product_images_read on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id));
create policy product_images_read_staff on public.product_images
  for select to authenticated
  using (public.has_permission('catalog:read'));

create policy product_variants_read on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_variants.product_id));
create policy product_variants_read_staff on public.product_variants
  for select to authenticated
  using (public.has_permission('catalog:read'));

-- Favoris --------------------------------------------------------------------
grant select, insert, delete on public.wishlists to authenticated;

create policy wishlists_read_own on public.wishlists
  for select to authenticated using (user_id = auth.uid());
create policy wishlists_insert_own on public.wishlists
  for insert to authenticated with check (user_id = auth.uid());
create policy wishlists_delete_own on public.wishlists
  for delete to authenticated using (user_id = auth.uid());

-- Promotions -----------------------------------------------------------------
grant select on public.promo_codes, public.promo_redemptions to authenticated;

create policy promo_codes_read_staff on public.promo_codes
  for select to authenticated
  using (public.has_permission('promos:write'));
create policy promo_redemptions_read_staff on public.promo_redemptions
  for select to authenticated
  using (public.has_permission('promos:write') or public.has_permission('orders:read'));

-- Livraison ------------------------------------------------------------------
grant select on public.shipping_zones, public.shipping_methods to anon, authenticated;

create policy shipping_zones_read_public on public.shipping_zones
  for select to anon, authenticated using (active = true);
create policy shipping_zones_read_staff on public.shipping_zones
  for select to authenticated using (public.has_permission('shipping:write'));

create policy shipping_methods_read_public on public.shipping_methods
  for select to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.shipping_zones z
       where z.id = shipping_methods.zone_id and z.active = true
    )
  );
create policy shipping_methods_read_staff on public.shipping_methods
  for select to authenticated using (public.has_permission('shipping:write'));

-- Commandes ------------------------------------------------------------------
grant select on public.orders, public.order_items, public.order_status_history,
  public.payments to authenticated;

create policy orders_read on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('orders:read'));

create policy order_items_read on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

create policy order_status_history_read on public.order_status_history
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_status_history.order_id));

create policy payments_read on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = payments.order_id));

-- Messages de contact --------------------------------------------------------
grant insert (name, email, subject, message) on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;

create policy contact_messages_insert_public on public.contact_messages
  for insert to anon, authenticated
  with check (status = 'new');

create policy contact_messages_read_staff on public.contact_messages
  for select to authenticated
  using (public.has_permission('messages:read'));

create policy contact_messages_update_staff on public.contact_messages
  for update to authenticated
  using (public.has_permission('messages:read'))
  with check (public.has_permission('messages:read'));

-- Réglages -------------------------------------------------------------------
grant select on public.settings to anon, authenticated;

create policy settings_read on public.settings
  for select to anon, authenticated
  using (is_public = true or public.has_permission('settings:write'));

-- Journal d'audit ------------------------------------------------------------
grant select on public.audit_log to authenticated;

create policy audit_log_read_staff on public.audit_log
  for select to authenticated
  using (public.has_permission('users:read'));

-- Aucun grant direct sur sessions (absentes), webhook_events, paiements en
-- écriture, promotions en écriture : ces opérations passent par service_role.

-- Rôle serveur ---------------------------------------------------------------
-- service_role contourne la RLS mais doit conserver les privilèges SQL.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Fonctions ------------------------------------------------------------------
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.create_order(jsonb, text, jsonb, uuid, text, text, text, uuid)
  to anon, authenticated, service_role;
grant execute on function public.update_order_status(uuid, text, text, uuid)
  to authenticated, service_role;
grant execute on function public.promote_first_admin(text) to service_role;
