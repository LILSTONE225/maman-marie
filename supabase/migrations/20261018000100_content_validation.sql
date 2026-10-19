-- Validation étendue : textes, images, thème, sections, légal.
create or replace function public.validate_site_data() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.data->'products') is distinct from 'array' then raise exception 'products must be an array'; end if;
  if coalesce(new.data->>'phoneCall','') !~ '^[0-9]{8,15}$' or coalesce(new.data->>'phoneWhatsapp','') !~ '^[0-9]{8,15}$' then raise exception 'invalid phone number'; end if;
  if new.data::text ~* '<\s*script|javascript:' then raise exception 'forbidden content'; end if;
  if new.data ? 'texts' and jsonb_typeof(new.data->'texts') is distinct from 'object' then raise exception 'texts must be an object'; end if;
  if new.data ? 'sections' and jsonb_typeof(new.data->'sections') is distinct from 'array' then raise exception 'sections must be an array'; end if;
  if new.data ? 'legal' and jsonb_typeof(new.data->'legal') is distinct from 'array' then raise exception 'legal must be an array'; end if;
  if new.data ? 'theme' and exists (select 1 from jsonb_each_text(new.data->'theme') t where t.value !~ '^#[0-9a-fA-F]{6}$') then raise exception 'invalid theme color'; end if;
  if new.data ? 'images' and exists (select 1 from jsonb_each_text(new.data->'images') i
      where i.value !~ '^(assets/img/[A-Za-z0-9_.-]+|https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/site-images/[A-Za-z0-9_/.-]+)$') then raise exception 'invalid image url'; end if;
  return new;
end $$;
