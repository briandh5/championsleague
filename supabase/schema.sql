-- La Previa · Champions: tablas compartidas para pines, confirmados y chats en tiempo real.
-- Cómo usarlo: Supabase → SQL Editor → New query → pega todo este archivo → Run.
-- Se puede correr más de una vez sin romper nada.

create table if not exists public.planes (
  id          text primary key,
  partido_id  text not null,
  snap        jsonb not null,
  lat         double precision not null,
  lng         double precision not null,
  pais        text not null check (char_length(pais) <= 80),
  estado      text not null check (char_length(estado) <= 80),
  ciudad      text not null check (char_length(ciudad) <= 80),
  lugar       text not null check (char_length(lugar) <= 120),
  tipo        text not null,
  hashtag     text not null check (hashtag ~ '^#[[:alnum:]_]{3,30}$'),
  anfitrion   text not null check (char_length(anfitrion) <= 40),
  creado      timestamptz not null default now()
);
create unique index if not exists planes_hashtag_unico on public.planes (lower(hashtag));

-- Llave secreta de cada pin: solo el dispositivo que lo creó la conoce y puede borrarlo.
create table if not exists public.planes_claves (
  plan_id text primary key references public.planes (id) on delete cascade,
  clave   text not null
);

create table if not exists public.confirmados (
  plan_id text not null references public.planes (id) on delete cascade,
  nombre  text not null check (char_length(nombre) between 1 and 40),
  creado  timestamptz not null default now(),
  primary key (plan_id, nombre)
);

-- sala = 'general' para el chat en vivo, o el id del plan para su chat.
create table if not exists public.mensajes (
  id     uuid primary key default gen_random_uuid(),
  sala   text not null,
  autor  text not null check (char_length(autor) between 1 and 40),
  texto  text not null check (char_length(texto) between 1 and 500),
  hora   timestamptz not null default now()
);
create index if not exists mensajes_sala_hora on public.mensajes (sala, hora);
-- Respuestas: copia corta del mensaje al que se contesta ({"autor": "...", "texto": "..."}).
alter table public.mensajes add column if not exists responde jsonb;

alter table public.planes        enable row level security;
alter table public.planes_claves enable row level security;
alter table public.confirmados   enable row level security;
alter table public.mensajes      enable row level security;

-- Todos pueden ver; nadie puede leer las llaves.
drop policy if exists "ver planes" on public.planes;
create policy "ver planes" on public.planes for select using (true);
drop policy if exists "ver confirmados" on public.confirmados;
create policy "ver confirmados" on public.confirmados for select using (true);
drop policy if exists "apuntarse" on public.confirmados;
create policy "apuntarse" on public.confirmados for insert with check (true);
drop policy if exists "desapuntarse" on public.confirmados;
create policy "desapuntarse" on public.confirmados for delete using (true);
drop policy if exists "ver mensajes" on public.mensajes;
create policy "ver mensajes" on public.mensajes for select using (true);
drop policy if exists "escribir" on public.mensajes;
create policy "escribir" on public.mensajes for insert with check (
  sala = 'general' or exists (select 1 from public.planes p where p.id = sala)
);

-- Crear un pin con su llave y su anfitrión ya confirmado.
create or replace function public.crear_plan(p jsonb, p_clave text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into planes (id, partido_id, snap, lat, lng, pais, estado, ciudad, lugar, tipo, hashtag, anfitrion, creado)
  values (p->>'id', p->>'partido_id', p->'snap', (p->>'lat')::float8, (p->>'lng')::float8,
          p->>'pais', p->>'estado', p->>'ciudad', p->>'lugar', p->>'tipo', p->>'hashtag', p->>'anfitrion',
          coalesce((p->>'creado')::timestamptz, now()));
  insert into planes_claves (plan_id, clave) values (p->>'id', p_clave);
  insert into confirmados (plan_id, nombre) values (p->>'id', p->>'anfitrion') on conflict do nothing;
end $$;

-- Borrar un pin solo con su llave. Devuelve false si la llave no coincide.
create or replace function public.borrar_plan(p_id text, p_clave text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from planes where id = p_id and exists (select 1 from planes_claves k where k.plan_id = p_id and k.clave = p_clave);
  get diagnostics n = row_count;
  if n > 0 then delete from mensajes where sala = p_id; end if;
  return n > 0;
end $$;

revoke all on function public.crear_plan(jsonb, text) from public;
revoke all on function public.borrar_plan(text, text) from public;
grant execute on function public.crear_plan(jsonb, text) to anon, authenticated;
grant execute on function public.borrar_plan(text, text) to anon, authenticated;

-- Tiempo real: avisa a todos los dispositivos cuando algo cambia.
do $$
declare t text;
begin
  foreach t in array array['planes', 'confirmados', 'mensajes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ───────── Editar y borrar mensajes propios, y mandar fotos ─────────
alter table public.mensajes add column if not exists imagen text;
alter table public.mensajes add column if not exists editado boolean not null default false;
-- Un mensaje puede ser solo foto: el texto ya no es obligatorio.
alter table public.mensajes drop constraint if exists mensajes_texto_check;
alter table public.mensajes add constraint mensajes_texto_check check (char_length(texto) <= 500);
alter table public.mensajes drop constraint if exists mensajes_imagen_check;
alter table public.mensajes add constraint mensajes_imagen_check check (imagen is null or char_length(imagen) <= 500);

-- Llave secreta de cada mensaje: solo el dispositivo que lo mandó puede editarlo o borrarlo.
create table if not exists public.mensajes_claves (
  mensaje_id uuid primary key references public.mensajes (id) on delete cascade,
  clave      text not null
);
alter table public.mensajes_claves enable row level security;

create or replace function public.enviar_mensaje(p jsonb, p_clave text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sala text := p->>'sala';
begin
  if v_sala <> 'general' and not exists (select 1 from planes where id = v_sala) then
    raise exception 'sala inexistente';
  end if;
  if coalesce(p->>'texto', '') = '' and coalesce(p->>'imagen', '') = '' then
    raise exception 'mensaje vacío';
  end if;
  insert into mensajes (id, sala, autor, texto, responde, imagen)
  values ((p->>'id')::uuid, v_sala, p->>'autor', coalesce(p->>'texto', ''), p->'responde', nullif(p->>'imagen', ''));
  insert into mensajes_claves (mensaje_id, clave) values ((p->>'id')::uuid, p_clave);
end $$;

create or replace function public.editar_mensaje(p_id uuid, p_clave text, p_texto text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update mensajes m set texto = p_texto, editado = true
  where m.id = p_id
    and exists (select 1 from mensajes_claves k where k.mensaje_id = p_id and k.clave = p_clave)
    and (p_texto <> '' or m.imagen is not null);
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.borrar_mensaje(p_id uuid, p_clave text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from mensajes where id = p_id and exists (select 1 from mensajes_claves k where k.mensaje_id = p_id and k.clave = p_clave);
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.enviar_mensaje(jsonb, text) from public;
revoke all on function public.editar_mensaje(uuid, text, text) from public;
revoke all on function public.borrar_mensaje(uuid, text) from public;
grant execute on function public.enviar_mensaje(jsonb, text) to anon, authenticated;
grant execute on function public.editar_mensaje(uuid, text, text) to anon, authenticated;
grant execute on function public.borrar_mensaje(uuid, text) to anon, authenticated;

-- Fotos del chat: carpeta pública "fotos" (máx. 5 MB, solo imágenes). Cualquiera con la app puede subir.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    execute 'drop policy if exists "subir fotos" on storage.objects';
    execute $p$create policy "subir fotos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'fotos')$p$;
  end if;
end $$;
