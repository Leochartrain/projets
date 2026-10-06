-- Carnet de famille : schéma initial.
--
-- Principe : une recette appartient à son auteur et n'est visible que par lui,
-- jusqu'à ce qu'il la partage dans un ou plusieurs groupes. Toutes les règles
-- d'accès sont appliquées par la base (Row Level Security) : même un appel
-- direct à l'API ne voit que ce que l'utilisateur a le droit de voir.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- Codes d'invitation : 6 caractères sans ambiguïté (pas de O/0, I/1), valables 7 jours.
create table public.invitations (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index invitations_group_idx on public.invitations (group_id);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  -- « Transmis par » : la personne de qui vient la recette (Mamie Jeanne…).
  passed_down_by text check (char_length(passed_down_by) <= 60),
  story text check (char_length(story) <= 2000),
  category text check (category in ('apero', 'entree', 'plat', 'accompagnement', 'dessert', 'boisson', 'autre')),
  servings numeric(6, 1) check (servings > 0),
  servings_label text check (char_length(servings_label) <= 30),
  prep_minutes integer check (prep_minutes between 0 and 10000),
  cook_minutes integer check (cook_minutes between 0 and 10000),
  -- [{ "quantity": 200, "unit": "g", "name": "chocolat noir" }, …]
  ingredients jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array'),
  -- ["Préchauffer le four…", …]
  steps jsonb not null default '[]' check (jsonb_typeof(steps) = 'array'),
  -- Chemins dans le stockage : photos du plat et photos de la fiche d'origine.
  photo_paths text[] not null default '{}',
  original_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Recherche plein texte en français (titre, transmis par, ingrédients).
  search tsvector generated always as (
    setweight(to_tsvector('french', coalesce(title, '')), 'A')
    || setweight(to_tsvector('french', coalesce(passed_down_by, '')), 'B')
    || setweight(to_tsvector('french', coalesce(jsonb_path_query_array(ingredients, '$[*].name')::text, '')), 'C')
  ) stored
);
create index recipes_author_idx on public.recipes (author_id, created_at desc);
create index recipes_search_idx on public.recipes using gin (search);

-- Une recette visible dans un groupe.
create table public.recipe_shares (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (recipe_id, group_id)
);
create index recipe_shares_group_idx on public.recipe_shares (group_id, shared_at desc);

-- Notes et commentaires : rattachés à un groupe, visibles par ses seuls membres.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  photo_path text,
  created_at timestamptz not null default now(),
  check (rating is not null or comment is not null)
);
create index reviews_recipe_idx on public.reviews (recipe_id, group_id, created_at desc);

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- ---------------------------------------------------------------------------
-- Fonctions d'accès (SECURITY DEFINER : elles lisent les appartenances sans
-- repasser par les règles, ce qui évite les boucles entre politiques)
-- ---------------------------------------------------------------------------

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

create function public.is_group_admin(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid() and role = 'admin');
$$;

-- Visible : c'est ma recette, ou elle est partagée dans un de mes groupes.
create function public.can_view_recipe(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.recipes where id = rid and author_id = auth.uid())
      or exists (
        select 1 from public.recipe_shares s
        join public.group_members m on m.group_id = s.group_id
        where s.recipe_id = rid and m.user_id = auth.uid()
      );
$$;

create function public.is_recipe_author(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.recipes where id = rid and author_id = auth.uid());
$$;

-- On voit le profil des gens avec qui on partage au moins un groupe.
create function public.shares_group_with(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select uid = auth.uid() or exists (
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------

-- Un profil est créé avec chaque compte (prénom choisi à l'inscription, sinon le début de l'e-mail).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Moi'), 40)
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Le créateur d'un groupe en devient administrateur.
create function public.handle_new_group() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end;
$$;
create trigger on_group_created after insert on public.groups
  for each row execute function public.handle_new_group();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Actions qui touchent plusieurs tables (appelées via supabase.rpc)
-- ---------------------------------------------------------------------------

-- Rejoindre un groupe avec un code d'invitation encore valable ; renvoie le groupe.
create function public.join_group(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;
  select group_id into target from public.invitations
  where code = upper(trim(invite_code)) and expires_at > now();
  if target is null then
    raise exception 'Code invalide ou expiré' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id) values (target, auth.uid())
  on conflict do nothing;
  return target;
end;
$$;

-- Nom du groupe derrière un code (pour l'écran « Rejoindre Famille Richard ? »), sans en être membre.
create function public.invitation_preview(invite_code text) returns table (group_id uuid, group_name text, member_count bigint)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, (select count(*) from public.group_members m where m.group_id = g.id)
  from public.invitations i join public.groups g on g.id = i.group_id
  where i.code = upper(trim(invite_code)) and i.expires_at > now();
$$;

-- Choisir les groupes où une recette est partagée (remplace la liste entière).
create function public.set_recipe_groups(rid uuid, gids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_recipe_author(rid) then
    raise exception 'Seul l''auteur peut partager cette recette' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(gids) g where not public.is_group_member(g)) then
    raise exception 'Tu ne fais pas partie de ce groupe' using errcode = '42501';
  end if;
  delete from public.recipe_shares where recipe_id = rid and not (group_id = any (gids));
  insert into public.recipe_shares (recipe_id, group_id)
  select rid, g from unnest(gids) g
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Règles d'accès (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invitations enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_shares enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;

create policy "profils visibles entre membres d'un même groupe" on public.profiles
  for select to authenticated using (public.shares_group_with(id));
create policy "chacun modifie son profil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "groupes visibles par leurs membres" on public.groups
  for select to authenticated using (public.is_group_member(id) or created_by = auth.uid());
create policy "tout le monde peut créer un groupe" on public.groups
  for insert to authenticated with check (created_by = auth.uid());
create policy "les administrateurs renomment le groupe" on public.groups
  for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "les administrateurs suppriment le groupe" on public.groups
  for delete to authenticated using (public.is_group_admin(id));

-- Pas d'ajout direct de membres : on rejoint avec join_group(), le créateur est ajouté par déclencheur.
create policy "membres visibles par les autres membres" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "les administrateurs changent les rôles" on public.group_members
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "on quitte un groupe, ou un administrateur retire un membre" on public.group_members
  for delete to authenticated using (user_id = auth.uid() or public.is_group_admin(group_id));

create policy "invitations visibles par les administrateurs" on public.invitations
  for select to authenticated using (public.is_group_admin(group_id));
create policy "les administrateurs créent des invitations" on public.invitations
  for insert to authenticated with check (public.is_group_admin(group_id) and created_by = auth.uid());
create policy "les administrateurs suppriment des invitations" on public.invitations
  for delete to authenticated using (public.is_group_admin(group_id));

create policy "recettes visibles par l'auteur et les groupes où elles sont partagées" on public.recipes
  -- L'auteur est vérifié directement : une recette tout juste créée n'est pas encore visible
  -- des fonctions dans la même requête (insert … returning).
  for select to authenticated using (author_id = auth.uid() or public.can_view_recipe(id));
create policy "on crée ses propres recettes" on public.recipes
  for insert to authenticated with check (author_id = auth.uid());
create policy "seul l'auteur modifie sa recette" on public.recipes
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "seul l'auteur supprime sa recette" on public.recipes
  for delete to authenticated using (author_id = auth.uid());

-- Les partages passent par set_recipe_groups() ; on peut seulement les lire.
create policy "partages visibles par l'auteur et les membres du groupe" on public.recipe_shares
  for select to authenticated using (public.is_recipe_author(recipe_id) or public.is_group_member(group_id));

create policy "avis visibles par les membres du groupe" on public.reviews
  for select to authenticated using (public.is_group_member(group_id));
create policy "on donne son avis sur une recette partagée dans son groupe" on public.reviews
  for insert to authenticated with check (
    author_id = auth.uid()
    and public.is_group_member(group_id)
    and exists (select 1 from public.recipe_shares s where s.recipe_id = reviews.recipe_id and s.group_id = reviews.group_id)
  );
create policy "on modifie son avis" on public.reviews
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "on supprime son avis" on public.reviews
  for delete to authenticated using (author_id = auth.uid());

create policy "chacun voit ses favoris" on public.favorites
  for select to authenticated using (user_id = auth.uid());
create policy "favori sur une recette visible" on public.favorites
  for insert to authenticated with check (user_id = auth.uid() and public.can_view_recipe(recipe_id));
create policy "chacun retire ses favoris" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

-- Supprimer son compte : le profil, ses recettes, avis et appartenances partent en cascade.
-- (Exigé par l'App Store et Google Play, et prévu par le RGPD.)
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Les visiteurs non connectés ne voient rien ; les fonctions d'action exigent un compte.
revoke execute on function public.join_group(text) from anon, public;
revoke execute on function public.set_recipe_groups(uuid, uuid[]) from anon, public;
revoke execute on function public.invitation_preview(text) from anon, public;
revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.set_recipe_groups(uuid, uuid[]) to authenticated;
grant execute on function public.invitation_preview(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Photos : un espace privé, rangé par auteur puis par recette
-- (« <auteur>/<recette>/<fichier> », ou « <auteur>/avatar/<fichier> »)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "on dépose ses photos dans son dossier" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "on supprime ses photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos visibles avec la recette" on storage.objects
  for select to authenticated using (
    bucket_id = 'photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[2] = 'avatar' and public.shares_group_with(((storage.foldername(name))[1])::uuid))
      or (
        (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
        and public.can_view_recipe(((storage.foldername(name))[2])::uuid)
      )
    )
  );
