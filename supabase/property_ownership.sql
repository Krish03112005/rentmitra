-- Run this in Supabase SQL Editor after configuring Clerk as a Supabase
-- Third-Party Auth provider. This keeps property writes owner-scoped and
-- removes the temporary anon fallback policies used during local debugging.

alter table public.properties
  add column if not exists owner_clerk_id text;

alter table public.properties
  add column if not exists contact_whatsapp text;

create index if not exists properties_owner_clerk_id_idx
  on public.properties(owner_clerk_id);

create extension if not exists pg_trgm;

create index if not exists properties_featured_created_at_idx
  on public.properties(is_featured, created_at desc);

create index if not exists properties_type_created_at_idx
  on public.properties(type, created_at desc);

create index if not exists properties_bedrooms_created_at_idx
  on public.properties(bedrooms, created_at desc);

create index if not exists properties_price_idx
  on public.properties(price);

create index if not exists properties_title_trgm_idx
  on public.properties using gin (title gin_trgm_ops);

create index if not exists properties_city_trgm_idx
  on public.properties using gin (city gin_trgm_ops);

create index if not exists properties_images_gin_idx
  on public.properties using gin (images);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_clerk_id_unique'
  ) then
    alter table public.users
      add constraint users_clerk_id_unique unique (clerk_id);
  end if;
end $$;

-- User profile access. The mobile app may sync a user's own profile fields,
-- but privileged flags such as is_admin must remain server-owned.
alter table public.users
  add column if not exists is_admin boolean;

update public.users
set is_admin = false
where is_admin is null;

alter table public.users
  alter column is_admin set default false;

alter table public.users
  alter column is_admin set not null;

alter table public.users enable row level security;

revoke all on table public.users from anon, authenticated;
grant select (clerk_id, email, first_name, last_name, avatar_url, is_admin)
  on table public.users to authenticated;
grant insert (clerk_id, email, first_name, last_name, avatar_url)
  on table public.users to authenticated;
grant update (email, first_name, last_name, avatar_url)
  on table public.users to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
  loop
    execute format(
      'drop policy if exists %I on public.users',
      existing_policy.policyname
    );
  end loop;
end $$;

create policy "Users can view their own profile"
  on public.users
  for select
  to authenticated
  using (
    (auth.jwt() ->> 'sub') is not null
    and (auth.jwt() ->> 'sub') = clerk_id
  );

create policy "Users can create their own profile"
  on public.users
  for insert
  to authenticated
  with check (
    (auth.jwt() ->> 'sub') is not null
    and (auth.jwt() ->> 'sub') = clerk_id
    and is_admin = false
  );

create policy "Users can update their own profile"
  on public.users
  for update
  to authenticated
  using (
    (auth.jwt() ->> 'sub') is not null
    and (auth.jwt() ->> 'sub') = clerk_id
  )
  with check (
    (auth.jwt() ->> 'sub') is not null
    and (auth.jwt() ->> 'sub') = clerk_id
  );

delete from public.saved_properties saved
using public.saved_properties duplicate
where saved.user_clerk_id = duplicate.user_clerk_id
  and saved.property_id = duplicate.property_id
  and duplicate.ctid < saved.ctid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_properties_user_property_unique'
  ) then
    alter table public.saved_properties
      add constraint saved_properties_user_property_unique
      unique (user_clerk_id, property_id);
  end if;
end $$;

create index if not exists saved_properties_user_property_idx
  on public.saved_properties(user_clerk_id, property_id);

create index if not exists saved_properties_property_id_idx
  on public.saved_properties(property_id);

-- Existing listings need a manual owner/contact backfill before their creators
-- can edit, delete, or mark them as sold. Example:
-- update public.properties
-- set owner_clerk_id = '<creator-clerk-user-id>',
--     contact_whatsapp = '<whatsapp-number-with-country-code>'
-- where id = '<property-id>';

update public.properties
set is_featured = false
where is_featured is null;

alter table public.properties
  alter column is_featured set default false;

alter table public.properties
  alter column is_featured set not null;

update public.properties
set is_sold = false
where is_sold is null;

alter table public.properties
  alter column is_sold set default false;

alter table public.properties
  alter column is_sold set not null;

create or replace view public.public_properties
with (security_barrier = true)
as
select
  id,
  title,
  description,
  price,
  type,
  bedrooms,
  bathrooms,
  area_sqft,
  address,
  city,
  case
    when latitude is null then null
    else round(latitude::numeric, 2)::double precision
  end as latitude,
  case
    when longitude is null then null
    else round(longitude::numeric, 2)::double precision
  end as longitude,
  images,
  is_featured,
  is_sold,
  created_at
from public.properties;

comment on view public.public_properties is
  'Public-safe listing projection. Excludes owner ids, contact numbers, and exact coordinates.';

alter table public.properties enable row level security;

revoke all on table public.properties from anon, authenticated;
revoke all on table public.public_properties from anon, authenticated;
grant select on table public.public_properties to anon, authenticated;
grant select on table public.properties to authenticated;
grant insert (
  title,
  description,
  price,
  type,
  bedrooms,
  bathrooms,
  area_sqft,
  address,
  city,
  latitude,
  longitude,
  images,
  owner_clerk_id,
  contact_whatsapp
) on table public.properties to authenticated;
grant update (
  title,
  description,
  price,
  type,
  bedrooms,
  bathrooms,
  area_sqft,
  address,
  city,
  latitude,
  longitude,
  images,
  is_sold,
  contact_whatsapp
) on table public.properties to authenticated;
grant delete on table public.properties to authenticated;

drop policy if exists "Properties are viewable by everyone" on public.properties;
drop policy if exists "Creators can view their own properties" on public.properties;
create policy "Creators can view their own properties"
  on public.properties
  for select
  to authenticated
  using ((auth.jwt() ->> 'sub') = owner_clerk_id);

drop policy if exists "Authenticated users can create their own properties" on public.properties;
create policy "Authenticated users can create their own properties"
  on public.properties
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'sub') = owner_clerk_id);

drop policy if exists "Public clients can create owned properties" on public.properties;

drop policy if exists "Creators can update their own properties" on public.properties;
create policy "Creators can update their own properties"
  on public.properties
  for update
  to authenticated
  using ((auth.jwt() ->> 'sub') = owner_clerk_id)
  with check ((auth.jwt() ->> 'sub') = owner_clerk_id);

drop policy if exists "Public clients can update owned properties" on public.properties;

drop policy if exists "Creators can delete their own properties" on public.properties;
create policy "Creators can delete their own properties"
  on public.properties
  for delete
  to authenticated
  using ((auth.jwt() ->> 'sub') = owner_clerk_id);

drop policy if exists "Public clients can delete owned properties" on public.properties;

create or replace function public.set_property_featured(
  property_id text,
  featured boolean
)
returns public.properties
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_property public.properties;
begin
  if not exists (
    select 1
    from public.users
    where clerk_id = (auth.jwt() ->> 'sub')
      and is_admin = true
  ) then
    raise exception 'Only admins can update featured properties'
      using errcode = '42501';
  end if;

  update public.properties
  set is_featured = featured
  where id::text = property_id
  returning * into updated_property;

  if updated_property.id is null then
    raise exception 'Property not found'
      using errcode = 'P0002';
  end if;

  return updated_property;
end;
$$;

revoke all on function public.set_property_featured(text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_property_featured(text, boolean)
  to authenticated;

create or replace function public.get_property_contact_whatsapp(
  target_property_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  whatsapp_number text;
begin
  if (auth.jwt() ->> 'sub') is null then
    raise exception 'Authentication is required to contact property owners'
      using errcode = '42501';
  end if;

  select contact_whatsapp
  into whatsapp_number
  from public.properties
  where id::text = target_property_id;

  if whatsapp_number is null or length(whatsapp_number) = 0 then
    raise exception 'Property contact is unavailable'
      using errcode = 'P0002';
  end if;

  return whatsapp_number;
end;
$$;

revoke all on function public.get_property_contact_whatsapp(text)
  from public, anon, authenticated;
grant execute on function public.get_property_contact_whatsapp(text)
  to authenticated;

alter table public.saved_properties enable row level security;

drop policy if exists "Users can view their own saved properties" on public.saved_properties;
create policy "Users can view their own saved properties"
  on public.saved_properties
  for select
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_clerk_id);

drop policy if exists "Users can save properties" on public.saved_properties;
create policy "Users can save properties"
  on public.saved_properties
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'sub') = user_clerk_id);

drop policy if exists "Users can remove their own saved properties" on public.saved_properties;
create policy "Users can remove their own saved properties"
  on public.saved_properties
  for delete
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_clerk_id);

-- Normalize old public Supabase image URLs into storage object paths. The app
-- now signs private bucket paths at render time instead of storing permanent
-- public URLs.
update public.properties
set images = normalized.images
from (
  select
    p.id,
    array_agg(
      case
        when image_value like '%/storage/v1/object/public/property-images/%'
          then split_part(image_value, '/storage/v1/object/public/property-images/', 2)
        when image_value like '%/storage/v1/object/sign/property-images/%'
          then split_part(split_part(image_value, '/storage/v1/object/sign/property-images/', 2), '?', 1)
        when image_value like '%/storage/v1/object/authenticated/property-images/%'
          then split_part(image_value, '/storage/v1/object/authenticated/property-images/', 2)
        else image_value
      end
      order by image_order
    ) as images
  from public.properties p
  cross join unnest(p.images) with ordinality as image_items(image_value, image_order)
  group by p.id
) normalized
where public.properties.id = normalized.id;

-- Property image storage. Private buckets require signed URLs for reads.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'property-images',
  'property-images',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Property images are publicly readable" on storage.objects;
drop policy if exists "Listed property images can be signed for reading" on storage.objects;
create policy "Listed property images can be signed for reading"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'property-images'
    and (
      exists (
        select 1
        from public.public_properties
        where public.public_properties.images @> array[storage.objects.name]
      )
      or (
        (auth.jwt() ->> 'sub') is not null
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
      )
    )
  );

drop policy if exists "Authenticated users can upload property images" on storage.objects;
create policy "Authenticated users can upload property images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "Public clients can upload property image files" on storage.objects;

drop policy if exists "Creators can update their property images" on storage.objects;
create policy "Creators can update their property images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "Creators can delete their property images" on storage.objects;
create policy "Creators can delete their property images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );
