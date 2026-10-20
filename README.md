# La Previa · Champions con tus amigos

App #4 del reto de 100 apps. Coordina con tus amigos dónde ver cada partido de la
Champions: mapa ilustrado con pines y hashtags, calendario por fases con marcador en vivo,
recordatorios, compartir plan, Google Calendar y chat rápido por evento.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 · SVG con d3-geo ·
Framer Motion · Lucide. Toda la interfaz vive en un solo componente:
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
| Confirmados y chat | "¡Me apunto!", chat rápido por plan y botón para borrar el plan. El mapa arranca vacío: solo aparecen los planes que alguien agrega. |

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
- Pines, confirmados, chat y tu nombre se guardan en el navegador (LocalStorage). Para chat
  entre varias personas en tiempo real el siguiente paso es conectar Supabase Realtime.

**Modo demo:** abre `/?demo=vivo` para adelantar el reloj al siguiente partido y ver
un marcador en vivo simulado.

## Correr en local

```bash
npm install
npm run dev
```

## Publicar en Vercel

1. Sube este proyecto a un repo vacío de GitHub.
2. En Vercel: **Add New → Project → Import** ese repo. No necesita variables de entorno.
