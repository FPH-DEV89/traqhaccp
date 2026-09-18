-- 0003_leads.sql — Prospects de la vitrine (chantier 3 : vendre)
--
-- Le formulaire de contact de la vitrine écrit ICI, dans le projet TraqHACCP.
-- Aucun formulaire tiers (Formspree, Netlify Forms...) : les prospects restent
-- chez nous, et `leads` n'est rattachée à aucun établissement — c'est un
-- carnet d'adresses commercial, pas une donnée de registre.
--
-- Idempotente : `if not exists` / `drop policy if exists` / `create or replace`.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nom           text not null,
  email         text not null,
  etablissement text,
  telephone     text,
  ville         text,
  message       text,
  statut        text not null default 'nouveau',
  source        text not null default 'vitrine',
  constraint leads_nom_longueur     check (char_length(nom) between 2 and 120),
  constraint leads_email_forme      check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint leads_email_longueur   check (char_length(email) <= 200),
  constraint leads_message_longueur check (message is null or char_length(message) <= 4000),
  constraint leads_statut_valeurs   check (statut in ('nouveau', 'contacte', 'essai', 'client', 'perdu'))
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_statut_idx     on public.leads (statut);
create index if not exists leads_email_idx      on public.leads (lower(email));

alter table public.leads enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Politiques
--
-- Une seule chose est publique : DÉPOSER un prospect. C'est tout.
-- Aucune politique de select/update/delete n'est créée, donc anon et
-- authenticated ne voient rien et ne modifient rien — c'est voulu, et pas un
-- oubli. La lecture passe par la clé de service (back-office / scripts).
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists leads_depot_public on public.leads;
create policy leads_depot_public on public.leads
  for insert to anon, authenticated
  with check (statut = 'nouveau' and source = 'vitrine');

-- ─────────────────────────────────────────────────────────────────────────────
-- Garde-fou anti-inondation
--
-- Un formulaire public est une porte ouverte. On plafonne à 5 dépôts par heure
-- et par adresse email : de quoi laisser passer un vrai prospect qui insiste,
-- pas de quoi noyer le carnet.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.limiter_depot_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recents integer;
begin
  select count(*) into recents
    from public.leads
   where lower(email) = lower(new.email)
     and created_at > now() - interval '1 hour';

  if recents >= 5 then
    raise exception 'Trop de demandes envoyées pour cette adresse : réessayez dans une heure.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_limiter_depot on public.leads;
create trigger leads_limiter_depot
  before insert on public.leads
  for each row execute function public.limiter_depot_lead();
