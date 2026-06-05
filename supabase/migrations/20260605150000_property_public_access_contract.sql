-- Required by the app's public listing screens.
-- Applies the safe public view, owner-scoped base-table reads, and protected
-- contact lookup used by Home, Search, Saved, and Property Detail.

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
