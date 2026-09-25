-- TraqHACCP — registre synchronise (migration 0004)
--
-- Contexte : l'application livree tient son registre cote client (lots,
-- recettes, DLC secondaires, temoins, ventes, brigade, reglages). Plutot que
-- de figer sept tables relationnelles qui divergeraient au premier champ
-- ajoute cote client, on stocke UNE LIGNE PAR ENREGISTREMENT :
--
--     (establishment_id, collection, record_id) -> payload jsonb
--
-- Le client fusionne en « dernier ecrit gagne » sur updated_at et materialise
-- ses suppressions par un jeton (deleted = true) pour qu'un autre appareil ne
-- ressuscite pas un enregistrement efface.
--
-- La table `settings` de la migration 0001 (etablissement_id + payload jsonb)
-- reste en place : elle visait l'ancienne architecture et n'est pas utilisee
-- par l'application livree.
--
-- Idempotente : rejouable sans erreur.

create table if not exists public.registry_records (
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  collection       text not null,
  record_id        text not null,
  payload          jsonb not null default '{}'::jsonb,
  deleted          boolean not null default false,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  primary key (establishment_id, collection, record_id)
);

-- Le client interroge « tout le registre de mon etablissement » : cet index
-- sert la lecture complete et le tri par fraicheur.
create index if not exists idx_registry_records_est_maj
  on public.registry_records (establishment_id, updated_at desc);

-- Horodatage serveur : le client ne peut ni antidater ni forger sa fraicheur.
create or replace function public.toucher_registry_records()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists trg_registry_records_touch on public.registry_records;
create trigger trg_registry_records_touch
  before insert or update on public.registry_records
  for each row execute function public.toucher_registry_records();

-- Cloisonnement : memes predicats que le reste du socle (migration 0001).
alter table public.registry_records enable row level security;

drop policy if exists p_read on public.registry_records;
create policy p_read on public.registry_records for select
  using (public.is_member(establishment_id));

drop policy if exists p_insert on public.registry_records;
create policy p_insert on public.registry_records for insert
  with check (public.can_write(establishment_id));

drop policy if exists p_update on public.registry_records;
create policy p_update on public.registry_records for update
  using (public.can_write(establishment_id))
  with check (public.can_write(establishment_id));

drop policy if exists p_delete on public.registry_records;
create policy p_delete on public.registry_records for delete
  using (public.can_delete(establishment_id));

-- La migration 0001 accordait les droits sur « all tables in schema public » :
-- une table creee apres coup ne les herite pas. Sans ces grants, PostgREST
-- renvoie 42501 (permission denied) a l'utilisateur pourtant legitime.
grant select, insert, update, delete on public.registry_records to authenticated;
