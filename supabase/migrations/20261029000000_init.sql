-- AI Wardrobe — schema iniziale
-- Ogni tabella è protetta da Row Level Security: un utente vede e modifica
-- soltanto le proprie righe. I vincoli CHECK rispecchiano gli schemi Zod
-- in src/lib/schemas.ts.

-- ---------------------------------------------------------------------------
-- Profili utente e preferenze di stile
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  style_preferences text[] not null default '{}',
  favorite_colors text[] not null default '{}',
  avoid_colors text[] not null default '{}',
  season_preferences text[] not null default '{}',
  fit_preferences text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Capi del guardaroba
-- ---------------------------------------------------------------------------
create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (category in (
    'tshirt_polo', 'shirt', 'knitwear', 'outerwear', 'trousers', 'shorts',
    'shoes', 'accessories', 'sportswear', 'other'
  )),
  subcategory text check (char_length(subcategory) <= 60),
  -- Posizione del capo nel corpo, usata dal motore di abbinamento.
  slot text not null check (slot in ('top', 'bottom', 'one_piece', 'outer', 'shoes', 'accessory')),
  image_path text,
  primary_color text not null default 'black',
  secondary_colors text[] not null default '{}',
  material text check (char_length(material) <= 60),
  pattern text not null default 'solid' check (pattern in (
    'solid', 'striped', 'checked', 'printed', 'floral', 'graphic', 'textured', 'other'
  )),
  seasons text[] not null default '{}',
  styles text[] not null default '{}',
  fit text check (fit in ('slim', 'regular', 'relaxed', 'oversize', 'cropped')),
  formality smallint not null default 2 check (formality between 1 and 5),
  brand text check (char_length(brand) <= 60),
  tags text[] not null default '{}',
  notes text check (char_length(notes) <= 500),
  is_favorite boolean not null default false,
  wear_count integer not null default 0 check (wear_count >= 0),
  last_worn_at date,
  ai_analyzed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_valid check (seasons <@ array['spring', 'summer', 'autumn', 'winter']::text[]),
  constraint tags_limit check (cardinality(tags) <= 20)
);

create index clothing_items_user_idx on public.clothing_items (user_id, created_at desc);
create index clothing_items_user_category_idx on public.clothing_items (user_id, category);

-- ---------------------------------------------------------------------------
-- Outfit e capi che li compongono
-- ---------------------------------------------------------------------------
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 1000),
  occasion text check (char_length(occasion) <= 40),
  style text check (char_length(style) <= 40),
  season text check (season in ('spring', 'summer', 'autumn', 'winter')),
  color_story text check (char_length(color_story) <= 600),
  tips text[] not null default '{}',
  rating smallint check (rating between 1 and 5),
  is_favorite boolean not null default false,
  source text not null default 'rules' check (source in ('ai', 'rules', 'manual')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outfits_user_idx on public.outfits (user_id, created_at desc);
create index outfits_user_favorite_idx on public.outfits (user_id) where is_favorite;

create table public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  item_id uuid not null references public.clothing_items (id) on delete cascade,
  role text not null check (role in ('top', 'mid', 'bottom', 'one_piece', 'outer', 'shoes', 'accessory')),
  position smallint not null default 0,
  primary key (outfit_id, item_id)
);

create index outfit_items_item_idx on public.outfit_items (item_id);

-- ---------------------------------------------------------------------------
-- Cronologia degli outfit indossati
-- ---------------------------------------------------------------------------
create table public.outfit_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  worn_on date not null default current_date,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create index outfit_history_user_idx on public.outfit_history (user_id, worn_on desc);
create index outfit_history_outfit_idx on public.outfit_history (outfit_id);

-- ---------------------------------------------------------------------------
-- Calendario: outfit pianificati (uno per giorno)
-- ---------------------------------------------------------------------------
create table public.planned_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  planned_for date not null,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  unique (user_id, planned_for)
);

create index planned_outfits_outfit_idx on public.planned_outfits (outfit_id);

-- ---------------------------------------------------------------------------
-- Registro delle chiamate AI (limite giornaliero per utente)
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('analyze', 'outfits')),
  created_at timestamptz not null default now()
);

create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------
create or replace function public.wardrobe_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.wardrobe_touch_updated_at();
create trigger clothing_items_touch before update on public.clothing_items
  for each row execute function public.wardrobe_touch_updated_at();
create trigger outfits_touch before update on public.outfits
  for each row execute function public.wardrobe_touch_updated_at();

-- Crea il profilo alla registrazione.
create or replace function public.wardrobe_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

-- Usata solo dal trigger: non deve essere richiamabile via API.
revoke execute on function public.wardrobe_handle_new_user() from public, anon, authenticated;

create trigger wardrobe_on_auth_user_created
  after insert on auth.users
  for each row execute function public.wardrobe_handle_new_user();

-- Quando un outfit viene indossato, aggiorna contatore e data di ultimo
-- utilizzo dei capi. Gira con i permessi dell'utente (RLS attiva).
create or replace function public.wardrobe_apply_outfit_worn()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.clothing_items ci
     set wear_count = ci.wear_count + 1,
         last_worn_at = greatest(coalesce(ci.last_worn_at, new.worn_on), new.worn_on)
   where ci.user_id = new.user_id
     and ci.id in (select oi.item_id from public.outfit_items oi where oi.outfit_id = new.outfit_id);
  return new;
end;
$$;

create trigger outfit_history_apply_worn
  after insert on public.outfit_history
  for each row execute function public.wardrobe_apply_outfit_worn();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clothing_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.outfit_history enable row level security;
alter table public.planned_outfits enable row level security;
alter table public.ai_usage enable row level security;

create policy "profiles: owner read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles: owner insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy "items: owner all" on public.clothing_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "outfits: owner all" on public.outfits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Un capo può entrare in un outfit solo se sia l'outfit sia il capo
-- appartengono all'utente corrente.
create policy "outfit_items: owner all" on public.outfit_items
  for all to authenticated
  using (
    exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
    and exists (select 1 from public.clothing_items ci where ci.id = item_id and ci.user_id = (select auth.uid()))
  );

create policy "history: owner all" on public.outfit_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
  );

create policy "planned: owner all" on public.planned_outfits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
  );

-- Il registro AI si può leggere e incrementare, non cancellare.
create policy "ai_usage: owner read" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_usage: owner insert" on public.ai_usage
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: bucket privato per le fotografie, una cartella per utente
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "wardrobe: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "wardrobe: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "wardrobe: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "wardrobe: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
