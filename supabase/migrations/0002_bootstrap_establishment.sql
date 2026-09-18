-- TraqHACCP — socle de donnees (migration 0002) : bootstrap d'un etablissement
-- Sans cette fonction, l'insertion directe est un cul-de-sac RLS : ecrire un etablissement
-- exige de le relire (return=representation), ce qui exige une adhesion qui n'existe pas
-- encore. On cree donc les deux d'un seul coup, en security definer.

create or replace function public.create_establishment(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'nom d''etablissement invalide';
  end if;
  insert into public.establishments (name) values (trim(p_name)) returning id into v_id;
  insert into public.memberships (user_id, establishment_id, role)
  values (auth.uid(), v_id, 'gerant');
  return v_id;
end $$;

grant execute on function public.create_establishment(text) to authenticated;

-- Seul le passage par la fonction cree un etablissement : plus d'insertion directe anonyme.
drop policy if exists p_insert on public.establishments;
drop policy if exists p_insert on public.memberships;
create policy p_insert on public.memberships for insert
  with check (public.can_admin(establishment_id));
