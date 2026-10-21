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
| Mapa caricatura | Dibujo SVG del mundo (Natural Earth + estados de EE. UU. incluidos en la app, sin APIs ni mosaicos). Arranca con el mundo completo dividido solo en continentes; al tocar uno, el mapa se acerca solo a esa zona (o pellizcas con dos dedos) y entonces aparecen los países. Ya en países, tocar uno lo encuadra y, más cerca, tocar un estado o provincia lo encuadra a él. Al acercar se cambian solas las costas y fronteras por las de Natural Earth 1:50m y aparecen los estados y provincias de todos los países con su nombre (archivos propios en `public/mapas`, se bajan solo la primera vez que acercas). El pellizco con dos dedos va suave y ya no brinca al soltar un dedo. Países vecinos con colores distintos y nombres que aparecen al acercar. México por regiones (El norte, CDMX, Veracruz, Oaxaca y sus playas, Riviera Maya y alrededores, Resto del sur) y EE. UU. por regiones (West Coast, Lo robado, Norte, East Coast). Francia en dorado con dos estrellas y el escudo del PSG; España con la Copa de fondo; al acercar, el escudo oficial de cada club en su estadio (CDN de ESPN; el PSG queda una sola vez, en Francia); al tocarlo sale una burbuja con su historia en la Champions (títulos con año y estrella, o su mejor resultado). |
| Pin personalizado | "Poner mi pin" → tocas el dibujo donde quieras, incluso en la vista de continentes (no usa tu ubicación) → formulario con partido, País, Estado, Ciudad (se llenan solos: país y estado de EE. UU. desde el propio dibujo, y estado y ciudad con OpenStreetMap solo para ese punto; todo se puede corregir), tipo de lugar, nombre del lugar, `#Hashtag` único y anfitrión. |
| Cinta deportiva | Tira tipo noticiero abajo (arriba de la barra en celular) que se desliza despacio hacia la izquierda con los juegos del día: fútbol (Liga MX, Liga MX Femenil, Leagues Cup y Concacaf Champions Cup), béisbol (MLB) y básquetbol (NBA). Las ligas sin juegos se juntan en un solo aviso. Al tocarla se abre "Hoy en los deportes" con botones de categoría (Fútbol, Béisbol, Básquetbol) y, en fútbol, una fila de ligas; cada partido abre su detalle con marcador, goleadores y minuto (fútbol), estadio, notas de ESPN que mencionan a los equipos, la ficha completa en ESPN y una búsqueda en Google Noticias. Datos del marcador público de ESPN vía `/api/ligas` y `/api/ligas/noticias` (sin llave), cada minuto. |
| Buscador flotante | Filtra los pines por hashtag, nombre de amigo, lugar o ciudad. Muestra los hashtags más populares. |
| Calendario | Abre en el día de hoy si hay partidos. Resultados reales con goleadores (minuto, penal o autogol) bajo cada marcador. Fases (Fase de liga, Play-off, Octavos, Cuartos, Semifinal, Final), tira de días y tarjetas con escudos, estado **En vivo** con marcador y minuto o **Próximamente** con hora local. |
| Recordatorios | 1 día y 1 hora antes, configurables por plan. Aviso dentro de la app y notificación del navegador. El botón **.ics** descarga el evento con las dos alarmas para que lleguen aunque la app esté cerrada. |
| Compartir plan | Enlace dinámico con el mensaje "¿Qué plan para Equipo A vs Equipo B?". Quien lo abre ve el pin y puede apuntarse. WhatsApp, Telegram, X o copiar. En celular usa el menú nativo de compartir. |
| Google Calendar | Botón que abre el evento con fecha, hora, lugar y lista de amigos ya llenos. |
| Confirmados y chat | "¡Me apunto!", chat rápido por plan y botón para borrar el plan (solo desde el dispositivo que lo creó). El mapa arranca vacío: solo aparecen los planes que alguien agrega. |
| Stats | Arriba, "Partidos de hoy" (o la última fecha jugada) con marcador, minuto en vivo, goleadores y la posición de cada club; en la tabla, ▲▼ con los lugares que subió o bajó cada uno con esos partidos. Tabla de la fase de liga (36 clubes) calculada con los resultados oficiales y el marcador en vivo: PJ, G, E, P, DG y puntos, con zonas de octavos, play-off y eliminados. En Partidos, bajo cada equipo se ve su posición y puntos para saber qué lugares se enfrentan. |
| Mi calendario y avisos | El icono de la copa en el encabezado abre tu día de hoy (tus planes, tus eventos personales y los partidos) y deja agregar eventos con enlace a Google Calendar. Un punto rojo cuenta las invitaciones a planes y los mensajes nuevos en los planes donde participas. Los eventos personales y lo ya leído se guardan en tu dispositivo. |
| Chat en vivo | Desliza un mensaje a la derecha (o doble clic) para responderlo; la respuesta muestra el mensaje citado. Toca un mensaje tuyo para editarlo o borrarlo (solo desde el dispositivo que lo mandó). Manda fotos con la cámara o desde la galería; se achican antes de subir. Sala general para ponerse de acuerdo en el momento, con cuántas personas están conectadas y sus nombres. |

## Datos

- **Calendario oficial UEFA 2026/27** tomado de uefa.com: los 144 partidos de la fase de liga
  (36 clubes, 8 jornadas) con fecha y hora, resultados de las jornadas 1 y 2, y las fechas de
  play-off, octavos, cuartos, semifinales y la final (5 de junio de 2027, Metropolitano). Vive en
  `FASE_LIGA` dentro del componente; para cargar un resultado nuevo se agrega `=goles:goles` al cruce.
- El estado (Próximamente / En vivo / Final) se calcula con la hora del partido. Los **resultados reales,
  el minuto y los goleadores** llegan del marcador público de **ESPN** (`app/api/partidos/route.ts`, sin
  llave) y se actualizan cada minuto; la tabla de Stats se recalcula con ellos. Si ESPN no responde se usa
  TheSportsDB (solo marcador, llave opcional `THESPORTSDB_KEY`), y si nada responde la tarjeta dice
  "en juego" o "resultado pendiente" sin inventar marcador.
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

