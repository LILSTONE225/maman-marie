// Génère supabase/seed.sql à partir de config.js, sans modifier aucune valeur.
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('../maman-marie/assets/js/config.js', import.meta.url), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const data = ctx.window.SITE_CONFIG;
const json = JSON.stringify(data);
if (json.includes('$mm$')) throw new Error('delimiter collision');
const lit = `$mm$${json}$mm$::jsonb`;
fs.writeFileSync(new URL('./seed.sql', import.meta.url),
`do $seed$
begin
create table if not exists public.site_published (
  id int primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.site_draft (
  id int primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.site_versions (
  id bigint generated always as identity primary key,
  data jsonb not null,
  note text,
  created_at timestamptz not null default now()
);
insert into public.site_published (id, data) values (1, ${lit}) on conflict (id) do nothing;
insert into public.site_draft (id, data) select 1, data from public.site_published where id = 1 on conflict (id) do nothing;
insert into public.site_versions (data, note) select data, 'Import initial depuis config.js' from public.site_published where id = 1;
end
$seed$;
`);
const variants = data.products.reduce((n, p) => n + (p.variants ? p.variants.length : 0), 0);
console.log(`seed.sql généré : ${data.products.length} produits, ${variants} variantes`);
