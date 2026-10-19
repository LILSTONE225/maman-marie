-- Espace propriétaire : un seul compte, brouillon -> publication, historique.
create table public.app_owner (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.app_owner enable row level security;
revoke all on public.app_owner from anon, authenticated;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_owner where user_id = (select auth.uid()))
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create table public.site_published (id int primary key check (id = 1), data jsonb not null, updated_at timestamptz not null default now());
create table public.site_draft     (id int primary key check (id = 1), data jsonb not null, updated_at timestamptz not null default now());
create table public.site_versions  (id bigint generated always as identity primary key, data jsonb not null, note text, created_at timestamptz not null default now());
alter table public.site_published enable row level security;
alter table public.site_draft     enable row level security;
alter table public.site_versions  enable row level security;

revoke all on public.site_published, public.site_draft, public.site_versions from anon, authenticated;
grant select on public.site_published to anon, authenticated;
grant select, insert, update on public.site_draft to authenticated;
grant select on public.site_versions to authenticated;

create policy published_read on public.site_published for select to anon, authenticated using (true);
create policy draft_select on public.site_draft for select to authenticated using ((select public.is_owner()));
create policy draft_insert on public.site_draft for insert to authenticated with check ((select public.is_owner()));
create policy draft_update on public.site_draft for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy versions_select on public.site_versions for select to authenticated using ((select public.is_owner()));

create function public.validate_site_data() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.data->'products') is distinct from 'array' then raise exception 'products must be an array'; end if;
  if coalesce(new.data->>'phoneCall','') !~ '^[0-9]{8,15}$' or coalesce(new.data->>'phoneWhatsapp','') !~ '^[0-9]{8,15}$' then raise exception 'invalid phone number'; end if;
  if new.data::text ~* '<\s*script|javascript:' then raise exception 'forbidden content'; end if;
  return new;
end $$;
create trigger site_draft_validate before insert or update on public.site_draft for each row execute function public.validate_site_data();

create function public.publish_site(note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  if not public.is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  select data into d from public.site_draft where id = 1;
  if d is null then raise exception 'no draft'; end if;
  insert into public.site_published (id, data, updated_at) values (1, d, now())
    on conflict (id) do update set data = excluded.data, updated_at = now();
  insert into public.site_versions (data, note) values (d, note);
end $$;

create function public.restore_version(vid bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.site_draft set data = (select data from public.site_versions where id = vid), updated_at = now() where id = 1;
  if not found then raise exception 'unknown version'; end if;
end $$;
revoke execute on function public.publish_site(text), public.restore_version(bigint) from public, anon;
grant execute on function public.publish_site(text), public.restore_version(bigint) to authenticated;

-- Storage : lecture publique, écriture réservée au propriétaire.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy site_images_select on storage.objects for select to authenticated using (bucket_id = 'site-images' and (select public.is_owner()));
create policy site_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'site-images' and (select public.is_owner()));
create policy site_images_update on storage.objects for update to authenticated using (bucket_id = 'site-images' and (select public.is_owner())) with check (bucket_id = 'site-images' and (select public.is_owner()));
create policy site_images_delete on storage.objects for delete to authenticated using (bucket_id = 'site-images' and (select public.is_owner()));
