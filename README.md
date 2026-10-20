# La Previa · Champions con tus amigos

App #4 del reto de 100 apps. Coordina con tus amigos dónde ver cada partido de la
Champions: mapa ilustrado con pines y hashtags, calendario por fases con marcador en vivo,
recordatorios, compartir plan, Google Calendar, chat por plan y un chat en vivo general.
Con Supabase conectado, todo lo que alguien agrega se ve al momento en todos los dispositivos.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 · SVG con d3-geo ·
Framer Motion · Lucide · Supabase (Postgres + Realtime). Toda la interfaz vive en un solo componente:
[`components/LaPrevia.tsx`](components/LaPrevia.tsx).

## Qué hace

| Parte | Detalle |
| --- | --- |
| Mapa caricatura | Dibujo SVG del mundo (Natural Earth + estados de EE. UU. incluidos en la app, sin APIs ni mosaicos). Países vecinos con colores distintos y nombres que aparecen al acercar. México por regiones (El norte, CDMX, Veracruz, Oaxaca y sus playas, Riviera Maya y alrededores, Resto del sur) y EE. UU. por regiones (West Coast, Lo robado, Norte, East Coast). Francia en dorado con dos estrellas y "Fuerza a la tierra del bi"; España con la Copa de fondo; al acercar, el escudo de cada club en su estadio. |
| Pin personalizado | "Poner mi pin" → tocas el dibujo donde quieras (no usa tu ubicación) → formulario con partido, País, Estado, Ciudad, tipo de lugar, nombre del lugar, `#Hashtag` único y anfitrión. |
| Buscador flotante | Filtra los pines por hashtag, nombre de amigo, lugar o ciudad. Muestra los hashtags más populares. |
| Calendario | Fases (Fase de liga, Play-off, Octavos, Cuartos, Semifinal, Final), tira de días y tarjetas con escudos, estado **En vivo** con marcador y minuto o **Próximamente** con hora local. |
| Recordatorios | 1 día y 1 hora antes, configurables por plan. Aviso dentro de la app y notificación del navegador. El botón **.ics** descarga el evento con las dos alarmas para que lleguen aunque la app esté cerrada. |
| Compartir plan | Enlace dinámico con el mensaje "¿Qué plan para Equipo A vs Equipo B?". Quien lo abre ve el pin y puede apuntarse. WhatsApp, Telegram, X o copiar. En celular usa el menú nativo de compartir. |
| Google Calendar | Botón que abre el evento con fecha, hora, lugar y lista de amigos ya llenos. |
| Confirmados y chat | "¡Me apunto!", chat rápido por plan y botón para borrar el plan (solo desde el dispositivo que lo creó). El mapa arranca vacío: solo aparecen los planes que alguien agrega. |
| Chat en vivo | Sala general para ponerse de acuerdo en el momento, con cuántas personas están conectadas y sus nombres. |

## Datos

- **Calendario oficial UEFA 2026/27** tomado de uefa.com: los 144 partidos de la fase de liga
  (36 clubes, 8 jornadas) con fecha y hora, resultados de las jornadas 1 y 2, y las fechas de
  play-off, octavos, cuartos, semifinales y la final (5 de junio de 2027, Metropolitano). Vive en
  `FASE_LIGA` dentro del componente; para cargar un resultado nuevo se agrega `=goles:goles` al cruce.
- El estado (Próximamente / En vivo / Final) se calcula con la hora del partido. El marcador en vivo
  se toma de **TheSportsDB** (`app/api/partidos/route.ts`) cuando responde; si no, la tarjeta dice
  "en juego" o "resultado pendiente" sin inventar marcador. Con una llave propia de TheSportsDB pon
  `THESPORTSDB_KEY` en Vercel.
- Escudos en alta resolución desde el CDN de API-Football; si alguno no carga se dibuja un
  escudo con los colores del club.
- **Con Supabase** (variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`): pines,
  confirmados, chat de cada plan y chat en vivo se guardan en la base y llegan al instante a todos
  los dispositivos (Supabase Realtime). Tablas y permisos en [`supabase/schema.sql`](supabase/schema.sql).
  Cada pin tiene una llave secreta que solo conoce el dispositivo que lo creó, y solo con ella se borra.
- **Sin Supabase** la app funciona igual, pero todo se queda en el navegador (LocalStorage).
- Tu nombre, tus recordatorios y las llaves de tus pines siempre se guardan en tu dispositivo.

**Modo demo:** abre `/?demo=vivo` para adelantar el reloj al siguiente partido y ver
un marcador en vivo simulado.

## Correr en local

```bash
npm install
npm run dev
```

## Publicar en Vercel

1. Sube este proyecto a un repo vacío de GitHub.
2. En Vercel: **Add New → Project → Import** ese repo.
3. Para compartir en tiempo real entre dispositivos (opcional):
   1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratis).
   2. **SQL Editor → New query**, pega [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**.
   3. En **Project Settings → API** copia la *Project URL* y la llave *anon public*.
   4. En Vercel → **Settings → Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL` y
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` con esos valores y vuelve a desplegar (**Redeploy**).

