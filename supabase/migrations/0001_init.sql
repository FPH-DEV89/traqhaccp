-- TraqHACCP — socle de donnees multi-etablissement (migration 0001)
-- Le tenant est l'ETABLISSEMENT : toutes les tables metier portent establishment_id.
-- L'isolation repose sur memberships (auth.uid() -> etablissement + role), pas sur le client.

create extension if not exists pgcrypto;

-- Comptes de connexion (auth.users) rattaches a un etablissement avec un role.
create table if not exists public.establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  siret text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  role text not null check (role in ('gerant','responsable','operateur','lecture','inspecteur')),
  operator_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, establishment_id)
);

-- Operateurs terrain (la "brigade") : ils signent les releves, ils ne se connectent pas.
create table if not exists public.operators (
  id text primary key,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  short text,
  initials text,
  role text not null default 'operateur',
  pin text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.equipments (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text,
  type text,
  min numeric,
  max numeric,
  current numeric,
  status text,
  last_log text,
  operator text,
  history jsonb not null default '[]'::jsonb,
  primary key (establishment_id, id)
);

-- Historique des releves de temperature, hors du JSON de l'equipement.
create table if not exists public.temperature_logs (
  id bigserial primary key,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  equipment_id text not null,
  temp numeric not null,
  status text,
  operator text,
  recorded_at timestamptz not null default now()
);
-- TraqHACCP — socle de donnees (migration 0001, partie 2/3) : registres metier

create table if not exists public.deliveries (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  supplier text, bl text,
  truck_temp numeric, prod_temp numeric, category text,
  conform_packaging boolean default true,
  conform_dlc boolean default true,
  decision text, time text, operator text, photo text,
  primary key (establishment_id, id)
);

create table if not exists public.preparations (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text, batch text, fab_date text, dlc_date text,
  duration_days integer, quantity text,
  allergens text[] not null default '{}',
  operator text, photo text,
  primary key (establishment_id, id)
);

create table if not exists public.allergen_dishes (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text, category text,
  allergens text[] not null default '{}',
  primary key (establishment_id, id)
);

create table if not exists public.cleaning_tasks (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  title text, zone text, freq text, status text, operator text, time text,
  ppe_required text,
  primary key (establishment_id, id)
);

create table if not exists public.fryers (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text, volume text,
  last_tpm numeric, status text, last_change text, operator text,
  primary key (establishment_id, id)
);

create table if not exists public.cooling_cycles (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  dish text, start_temp numeric, end_temp numeric,
  start_time text, end_time text, duration_minutes integer,
  status text, operator text,
  primary key (establishment_id, id)
);

create table if not exists public.defrost_cycles (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  product text, batch_origin text, start_date text, max_dlc_date text,
  chamber_name text, status text, operator text,
  primary key (establishment_id, id)
);

create table if not exists public.non_conformities (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  date text, category_5m text, severity text,
  equip_or_subject text, cause text, action text,
  operator text, status text,
  primary key (establishment_id, id)
);
-- TraqHACCP — socle de donnees (migration 0001, partie 3/3) : reste + index

create table if not exists public.checklists (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  type text, date text,
  items jsonb not null default '[]'::jsonb,
  validated boolean not null default false,
  operator text, time text,
  primary key (establishment_id, id)
);

create table if not exists public.sanitary_documents (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  title text, category text, issuer text,
  file_date text, expire_date text, notes text, file_data text, status text,
  primary key (establishment_id, id)
);

create table if not exists public.ph_records (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  product text, measured_ph numeric, target_max_ph numeric,
  comment text, operator text, time text, status text,
  primary key (establishment_id, id)
);

create table if not exists public.weight_records (
  id text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  dish_name text, target_weight numeric, measured_weight numeric,
  tolerance_percent numeric, delta numeric, status text, operator text, time text,
  primary key (establishment_id, id)
);

create table if not exists public.activity_log (
  id bigserial primary key,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_temperature_logs_est on public.temperature_logs (establishment_id, recorded_at desc);
create index if not exists idx_activity_log_est on public.activity_log (establishment_id, created_at desc);
create index if not exists idx_memberships_est on public.memberships (establishment_id);
create index if not exists idx_operators_est on public.operators (establishment_id);
-- TraqHACCP — socle de donnees (migration 0001, partie 4/5) : cloisonnement RLS
-- Le role applicatif est lu dans memberships, jamais dans le JWT : un utilisateur change
-- de role sans re-emettre de token. security definer = pas de recursion RLS.

create or replace function public.current_role(est uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m
  where m.user_id = auth.uid() and m.establishment_id = est
$$;

create or replace function public.is_member(est uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.establishment_id = est)
$$;

-- records.create / records.edit / records.sign
create or replace function public.can_write(est uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role(est) in ('gerant','responsable','operateur'), false)
$$;

-- records.delete
create or replace function public.can_delete(est uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role(est) in ('gerant','responsable'), false)
$$;

-- nc.manage / settings.edit / equipment.manage
create or replace function public.can_manage(est uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role(est) in ('gerant','responsable'), false)
$$;

-- users.manage / backup.restore
create or replace function public.can_admin(est uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role(est) = 'gerant', false)
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on schema public from anon;
-- TraqHACCP — socle de donnees (migration 0001, partie 5/5) : politiques
-- Groupe A (releves du quotidien) : ecriture ouverte aux operateurs, suppression non.
-- Groupe B (referentiel et conformite) : ecriture reservee a gerant/responsable.

do $$
declare
  t text;
  a text[] := array['deliveries','preparations','allergen_dishes','cleaning_tasks',
                    'cooling_cycles','defrost_cycles','ph_records','weight_records','checklists'];
  b text[] := array['equipments','fryers','settings','non_conformities','operators',
                    'sanitary_documents'];
begin
  foreach t in array a loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('create policy p_read on public.%I for select using (public.is_member(establishment_id))', t);
    execute format('drop policy if exists p_insert on public.%I', t);
    execute format('create policy p_insert on public.%I for insert with check (public.can_write(establishment_id))', t);
    execute format('drop policy if exists p_update on public.%I', t);
    execute format('create policy p_update on public.%I for update using (public.can_write(establishment_id)) with check (public.can_write(establishment_id))', t);
    execute format('drop policy if exists p_delete on public.%I', t);
    execute format('create policy p_delete on public.%I for delete using (public.can_delete(establishment_id))', t);
  end loop;
  foreach t in array b loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('create policy p_read on public.%I for select using (public.is_member(establishment_id))', t);
    execute format('drop policy if exists p_insert on public.%I', t);
    execute format('create policy p_insert on public.%I for insert with check (public.can_manage(establishment_id))', t);
    execute format('drop policy if exists p_update on public.%I', t);
    execute format('create policy p_update on public.%I for update using (public.can_manage(establishment_id)) with check (public.can_manage(establishment_id))', t);
    execute format('drop policy if exists p_delete on public.%I', t);
    execute format('create policy p_delete on public.%I for delete using (public.can_delete(establishment_id))', t);
  end loop;
end $$;
-- TraqHACCP — socle de donnees (migration 0001, partie 6) : tables sensibles

alter table public.temperature_logs enable row level security;
drop policy if exists p_read on public.temperature_logs;
create policy p_read on public.temperature_logs for select using (public.is_member(establishment_id));
drop policy if exists p_insert on public.temperature_logs;
create policy p_insert on public.temperature_logs for insert with check (public.can_write(establishment_id));
drop policy if exists p_delete on public.temperature_logs;
create policy p_delete on public.temperature_logs for delete using (public.can_delete(establishment_id));

alter table public.activity_log enable row level security;
drop policy if exists p_read on public.activity_log;
create policy p_read on public.activity_log for select using (public.is_member(establishment_id));
drop policy if exists p_insert on public.activity_log;
create policy p_insert on public.activity_log for insert with check (public.can_write(establishment_id));

-- memberships : chacun voit ses rattachements ; le premier gerant peut se declarer lui-meme.
alter table public.memberships enable row level security;
drop policy if exists p_read on public.memberships;
create policy p_read on public.memberships for select
  using (user_id = auth.uid() or public.can_admin(establishment_id));
drop policy if exists p_insert on public.memberships;
create policy p_insert on public.memberships for insert
  with check (
    public.can_admin(establishment_id)
    or (user_id = auth.uid() and role = 'gerant'
        and not exists (select 1 from public.memberships m2
                        where m2.establishment_id = memberships.establishment_id))
  );
drop policy if exists p_update on public.memberships;
create policy p_update on public.memberships for update
  using (public.can_admin(establishment_id)) with check (public.can_admin(establishment_id));
drop policy if exists p_delete on public.memberships;
create policy p_delete on public.memberships for delete using (public.can_admin(establishment_id));

alter table public.establishments enable row level security;
drop policy if exists p_read on public.establishments;
create policy p_read on public.establishments for select using (public.is_member(id));
drop policy if exists p_insert on public.establishments;
create policy p_insert on public.establishments for insert with check (auth.uid() is not null);
drop policy if exists p_update on public.establishments;
create policy p_update on public.establishments for update
  using (public.can_admin(id)) with check (public.can_admin(id));
