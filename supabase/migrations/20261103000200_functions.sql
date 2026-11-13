-- ============================================================================
-- HP COLLECTION — fonctions de production (Supabase / PostgreSQL)
--
-- Contient :
--   * la création automatique du profil à l'inscription Supabase Auth ;
--   * les helpers RBAC utilisés par les policies RLS ;
--   * create_order(), qui recalcule prix, stock, promotion et livraison côté
--     serveur dans une transaction et fige les lignes de commande ;
--   * update_order_status(), avec machine à états et restitution du stock ;
--   * promote_first_admin(), bootstrap contrôlé du premier administrateur.
--
-- Ces fonctions n'ont pas été exécutées contre un projet Supabase réel.
-- ============================================================================

-- Profil automatique ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers RBAC ---------------------------------------------------------------
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      join public.role_permissions rp on rp.role_slug = p.role_slug
     where p.id = auth.uid()
       and p.status = 'active'
       and rp.permission = p_permission
  );
$$;

-- Bootstrap du premier administrateur ----------------------------------------
-- Exécutable uniquement avec la clé service_role (ou depuis le SQL Editor).
-- Refuse de s'exécuter si un administrateur actif existe déjà.
create or replace function public.promote_first_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'invalid_email';
  end if;
  if exists (select 1 from public.profiles where role_slug = 'admin' and status = 'active') then
    raise exception 'admin_already_exists';
  end if;

  update public.profiles
     set role_slug = 'admin'
   where email = btrim(p_email)::citext
  returning id into v_id;

  if v_id is null then
    raise exception 'profile_not_found';
  end if;

  insert into public.audit_log (actor_user_id, action, entity, entity_id, details)
  values (null, 'admin.bootstrap', 'profile', v_id::text, jsonb_build_object('email', btrim(p_email)));
  return v_id;
end;
$$;

-- Création de commande -------------------------------------------------------
create or replace function public.create_order(
  p_items jsonb,
  p_email text,
  p_address jsonb,
  p_shipping_method_id uuid,
  p_promo_code text default null,
  p_payment_method text default 'cod',
  p_customer_note text default '',
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_service boolean := public.is_service_role();
  v_user_id uuid;
  v_item record;
  v_variant record;
  v_line record;
  v_promo public.promo_codes%rowtype;
  v_promo_found boolean := false;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_net integer;
  v_shipping integer := 0;
  v_total integer;
  v_effective integer;
  v_method record;
  v_order_id uuid := gen_random_uuid();
  v_reference text;
  v_now timestamptz := now();
  v_used integer;
  v_attempt integer;
  v_country text;
  v_phone text;
  v_label text;
  v_email citext;
begin
  if p_email is null or btrim(p_email) = '' or position('@' in p_email) = 0 then
    raise exception 'invalid_email';
  end if;
  if char_length(p_email) > 254 then
    raise exception 'invalid_email';
  end if;
  v_email := btrim(p_email)::citext;

  if p_payment_method not in ('cod', 'mobile_money') then
    raise exception 'invalid_payment_method';
  end if;
  if p_payment_method = 'mobile_money' then
    raise exception 'payment_not_configured';
  end if;
  if coalesce((select value from public.settings where key = 'codEnabled'), 'true') <> 'true' then
    raise exception 'payment_unavailable';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;
  if p_customer_note is not null and char_length(p_customer_note) > 1000 then
    raise exception 'note_too_long';
  end if;

  if p_address is null or jsonb_typeof(p_address) <> 'object' then
    raise exception 'invalid_address';
  end if;
  if coalesce(btrim(p_address ->> 'firstName'), '') = ''
     or coalesce(btrim(p_address ->> 'lastName'), '') = ''
     or coalesce(btrim(p_address ->> 'line1'), '') = ''
     or coalesce(btrim(p_address ->> 'postalCode'), '') = ''
     or coalesce(btrim(p_address ->> 'city'), '') = ''
     or coalesce(btrim(p_address ->> 'country'), '') = ''
  then
    raise exception 'invalid_address';
  end if;
  v_country := upper(btrim(p_address ->> 'country'));
  if char_length(v_country) <> 2 then
    raise exception 'invalid_country';
  end if;
  v_phone := coalesce(nullif(btrim(p_address ->> 'phone'), ''), '');

  -- Un appel direct depuis le navigateur ne peut pas usurper un user_id :
  -- seul le service_role peut le fournir explicitement.
  if v_is_service then
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
  end if;
  if v_user_id is not null and not exists (
    select 1 from public.profiles where id = v_user_id and status = 'active'
  ) then
    raise exception 'invalid_user';
  end if;

  drop table if exists pg_temp.cart_lines;
  create temporary table pg_temp.cart_lines (
    variant_id       uuid primary key,
    product_id       uuid not null,
    product_name     text not null,
    product_reference text not null,
    variant_size     text not null,
    variant_color    text not null,
    image_url        text,
    unit_price_cents integer not null,
    quantity         integer not null,
    line_total_cents integer not null
  ) on commit drop;

  for v_item in
    select (entry ->> 'variantId')::uuid as variant_id,
           sum((entry ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) as entry
     group by 1
  loop
    if v_item.variant_id is null then
      raise exception 'variant_not_found';
    end if;
    if v_item.quantity is null or v_item.quantity <= 0 or v_item.quantity > 100 then
      raise exception 'invalid_quantity';
    end if;

    select v.id, v.stock, v.is_active, v.size, v.color,
           p.id as product_id, p.name, p.reference, p.status,
           p.price_cents, p.sale_price_cents, p.sale_starts_at, p.sale_ends_at,
           c.published as category_published,
           (
             select pi.url
               from public.product_images pi
              where pi.product_id = p.id
              order by pi.sort_order, pi.created_at
              limit 1
           ) as image_url
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.categories c on c.id = p.category_id
     where v.id = v_item.variant_id
     for update of v;

    if not found then
      raise exception 'variant_not_found';
    end if;
    if v_variant.status <> 'published'
       or v_variant.category_published = false
       or v_variant.is_active = false
    then
      raise exception 'variant_unavailable';
    end if;
    if v_item.quantity > v_variant.stock then
      raise exception 'insufficient_stock';
    end if;

    v_effective := case
      when v_variant.sale_price_cents is not null
       and (v_variant.sale_starts_at is null or v_variant.sale_starts_at <= v_now)
       and (v_variant.sale_ends_at is null or v_variant.sale_ends_at >= v_now)
      then v_variant.sale_price_cents
      else v_variant.price_cents
    end;

    v_subtotal := v_subtotal + (v_effective * v_item.quantity);
    insert into pg_temp.cart_lines (
      variant_id, product_id, product_name, product_reference,
      variant_size, variant_color, image_url,
      unit_price_cents, quantity, line_total_cents
    ) values (
      v_variant.id, v_variant.product_id, v_variant.name, v_variant.reference,
      v_variant.size, v_variant.color, v_variant.image_url,
      v_effective, v_item.quantity, v_effective * v_item.quantity
    );
  end loop;

  if v_subtotal <= 0 then
    raise exception 'empty_cart';
  end if;

  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    select * into v_promo
      from public.promo_codes
     where code = btrim(p_promo_code)::citext
     for update;
    v_promo_found := found;

    if not v_promo_found or v_promo.active = false then
      raise exception 'promo_invalid';
    end if;
    if v_promo.starts_at is not null and v_promo.starts_at > v_now then
      raise exception 'promo_invalid';
    end if;
    if v_promo.ends_at is not null and v_promo.ends_at < v_now then
      raise exception 'promo_invalid';
    end if;
    if v_subtotal < v_promo.min_subtotal_cents then
      raise exception 'promo_min_subtotal';
    end if;
    if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
      raise exception 'promo_limit_reached';
    end if;
    if v_promo.max_uses_per_customer is not null then
      select count(*) into v_used
        from public.promo_redemptions
       where promo_id = v_promo.id
         and (email = v_email or (v_user_id is not null and user_id = v_user_id));
      if v_used >= v_promo.max_uses_per_customer then
        raise exception 'promo_limit_reached';
      end if;
    end if;

    if v_promo.type = 'percent' then
      -- value est exprimé en points de base (1000 = 10 %), comme dans l'API locale.
      v_discount := floor(v_subtotal * v_promo.value / 10000.0)::integer;
    else
      v_discount := least(v_promo.value, v_subtotal);
    end if;
    v_discount := greatest(0, least(v_discount, v_subtotal));
  end if;

  v_net := v_subtotal - v_discount;

  select m.id, m.name, m.price_cents, m.free_over_cents, m.min_days, m.max_days,
         z.id as zone_id, z.name as zone_name
    into v_method
    from public.shipping_methods m
    join public.shipping_zones z on z.id = m.zone_id
   where m.id = p_shipping_method_id
     and m.active = true
     and z.active = true
     and position(
       ',' || v_country || ','
       in ',' || replace(upper(z.countries), ' ', '') || ','
     ) > 0
   for update of m;

  if not found then
    raise exception 'shipping_unavailable';
  end if;

  v_shipping := case
    when v_method.free_over_cents is not null and v_net >= v_method.free_over_cents then 0
    else v_method.price_cents
  end;
  v_total := v_net + v_shipping;
  if v_total < 0 then
    raise exception 'invalid_total';
  end if;

  v_reference := null;
  for v_attempt in 1..8 loop
    v_reference := 'HP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.orders where reference = v_reference);
    v_reference := null;
  end loop;
  if v_reference is null then
    raise exception 'reference_generation_failed';
  end if;

  v_label := v_method.zone_name || ' · ' || v_method.name;
  if v_method.min_days is not null and v_method.max_days is not null then
    v_label := v_label || ' — ' || v_method.min_days || ' à ' || v_method.max_days || ' jours ouvrés';
  end if;

  insert into public.orders (
    id, reference, user_id, email, phone, status, payment_method, payment_status,
    subtotal_cents, discount_cents, shipping_cents, total_cents, currency,
    promo_code, promo_id,
    shipping_first_name, shipping_last_name, shipping_line1, shipping_line2,
    shipping_postal_code, shipping_city, shipping_country,
    shipping_zone_id, shipping_method_id, shipping_method_label,
    customer_note, created_at, updated_at
  ) values (
    v_order_id, v_reference, v_user_id, v_email, v_phone, 'pending', p_payment_method, 'pending',
    v_subtotal, v_discount, v_shipping, v_total, 'XOF',
    case when v_promo_found then v_promo.code::text else null end,
    case when v_promo_found then v_promo.id else null end,
    btrim(p_address ->> 'firstName'), btrim(p_address ->> 'lastName'),
    btrim(p_address ->> 'line1'), coalesce(btrim(p_address ->> 'line2'), ''),
    btrim(p_address ->> 'postalCode'), btrim(p_address ->> 'city'), v_country,
    v_method.zone_id, v_method.id, v_label,
    coalesce(p_customer_note, ''), v_now, v_now
  );

  for v_line in select * from pg_temp.cart_lines loop
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, product_reference,
      variant_size, variant_color, image_url, unit_price_cents, quantity, line_total_cents
    ) values (
      v_order_id, v_line.product_id, v_line.variant_id, v_line.product_name,
      v_line.product_reference, v_line.variant_size, v_line.variant_color,
      v_line.image_url, v_line.unit_price_cents, v_line.quantity, v_line.line_total_cents
    );

    update public.product_variants
       set stock = stock - v_line.quantity
     where id = v_line.variant_id
       and stock >= v_line.quantity;
    if not found then
      raise exception 'insufficient_stock';
    end if;
  end loop;

  if v_promo_found then
    insert into public.promo_redemptions (promo_id, order_id, user_id, email)
    values (v_promo.id, v_order_id, v_user_id, v_email);
    update public.promo_codes set used_count = used_count + 1 where id = v_promo.id;
  end if;

  insert into public.order_status_history (
    order_id, from_status, to_status, note, actor_user_id, actor_label, created_at
  ) values (
    v_order_id, null, 'pending', 'Commande créée', v_user_id, 'Client', v_now
  );

  insert into public.audit_log (actor_user_id, action, entity, entity_id, details)
  values (
    v_user_id, 'order.create', 'order', v_order_id::text,
    jsonb_build_object(
      'reference', v_reference,
      'totalCents', v_total,
      'itemCount', (select count(*) from pg_temp.cart_lines)
    )
  );

  return jsonb_build_object(
    'id', v_order_id,
    'reference', v_reference,
    'status', 'pending',
    'paymentMethod', p_payment_method,
    'paymentStatus', 'pending',
    'subtotalCents', v_subtotal,
    'discountCents', v_discount,
    'shippingCents', v_shipping,
    'totalCents', v_total,
    'currency', 'XOF',
    'promoCode', case when v_promo_found then v_promo.code::text else null end
  );
end;
$$;

-- Transition de statut -------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_next_status text,
  p_note text default '',
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_actor uuid;
  v_label text;
  v_payment_status text;
  v_now timestamptz := now();
begin
  if not (public.is_service_role() or public.has_permission('orders:write')) then
    raise exception 'forbidden';
  end if;

  -- Seul le service_role peut fournir un acteur explicite ; un staff authentifié
  -- ne peut pas falsifier l'auteur inscrit dans l'historique.
  if public.is_service_role() then
    v_actor := coalesce(p_actor_id, auth.uid());
  else
    v_actor := auth.uid();
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
   for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status = p_next_status then
    raise exception 'status_unchanged';
  end if;
  if not (
    (v_order.status = 'pending'   and p_next_status in ('confirmed', 'cancelled')) or
    (v_order.status = 'confirmed' and p_next_status in ('preparing', 'cancelled')) or
    (v_order.status = 'preparing' and p_next_status in ('shipped', 'cancelled')) or
    (v_order.status = 'shipped'   and p_next_status = 'delivered') or
    (v_order.status = 'delivered' and p_next_status = 'refunded')
  ) then
    raise exception 'invalid_transition';
  end if;

  v_payment_status := case
    when p_next_status = 'delivered' then 'paid'
    when p_next_status = 'refunded' then 'refunded'
    else null
  end;

  update public.orders
     set status = p_next_status,
         payment_status = coalesce(v_payment_status, payment_status),
         updated_at = v_now
   where id = p_order_id;

  if p_next_status = 'cancelled' and v_order.stock_released = false then
    for v_item in
      select variant_id, quantity
        from public.order_items
       where order_id = p_order_id and variant_id is not null
    loop
      update public.product_variants
         set stock = stock + v_item.quantity
       where id = v_item.variant_id;
    end loop;
    update public.orders set stock_released = true, updated_at = v_now where id = p_order_id;
  end if;

  if v_payment_status is not null then
    update public.payments
       set status = v_payment_status, updated_at = v_now
     where order_id = p_order_id;
  end if;

  select coalesce(nullif(full_name, ''), email::text, 'Équipe')
    into v_label
    from public.profiles
   where id = v_actor;

  insert into public.order_status_history (
    order_id, from_status, to_status, note, actor_user_id, actor_label, created_at
  ) values (
    p_order_id, v_order.status, p_next_status, coalesce(p_note, ''),
    v_actor, coalesce(v_label, 'Équipe'), v_now
  );

  insert into public.audit_log (actor_user_id, action, entity, entity_id, details)
  values (
    v_actor, 'order.status.update', 'order', p_order_id::text,
    jsonb_build_object('from', v_order.status, 'to', p_next_status, 'note', coalesce(p_note, ''))
  );

  return jsonb_build_object(
    'id', p_order_id,
    'status', p_next_status,
    'paymentStatus', coalesce(v_payment_status, v_order.payment_status),
    'updatedAt', v_now
  );
end;
$$;

-- Droits d'exécution ---------------------------------------------------------
revoke all on function public.promote_first_admin(text) from public;
revoke all on function public.promote_first_admin(text) from anon;
revoke all on function public.promote_first_admin(text) from authenticated;
grant execute on function public.promote_first_admin(text) to service_role;

revoke all on function public.create_order(jsonb, text, jsonb, uuid, text, text, text, uuid) from public;
grant execute on function public.create_order(jsonb, text, jsonb, uuid, text, text, text, uuid)
  to anon, authenticated, service_role;

revoke all on function public.update_order_status(uuid, text, text, uuid) from public;
grant execute on function public.update_order_status(uuid, text, text, uuid)
  to authenticated, service_role;
